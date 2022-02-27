import puppeteer, { Browser, Page } from 'puppeteer';
import { CompanyDTO } from '../company/company.dto';
import { JobDetailViecLam365DTO } from '../job/job-detail-vieclam365.dto';
import { JobDetailDTO } from '../job/job-detail.dto';
import { JobOverallDTO } from '../job/job-overall.dto';
import logger from '../logger';
import AbstractCrawler from './crawler.abstract';

export default class Vieclam365Crawler extends AbstractCrawler {
    async crawl(
		keyword: string,
		headless: boolean = true,
		baseUrl: string = 'https://timviec365.vn/',
		searchUrl: string = 'https://www.topcv.vn/viec-lam'
	): Promise<JobDetailDTO[]> {
		try {
			 const jobDetails: JobDetailDTO[] = [];
			 var startTime = performance.now();
			 this.log('info', `Vieclam365 Crawler: has just started and crawling for keyword: ${keyword} - URL: ${baseUrl}`);
			
			 const browser = await this.launchBrowser(baseUrl, headless);
			 let page = await this.goto(browser, searchUrl);
			 page = await this.search(page, keyword);
			 const totalPage = await this.getTotalPageNumber(page);
			// const jobs = await this.crawlAllJobs(page, totalPage);
			// for (let i = 0; i < jobs.length; i++) {
			// 	const job: JobOverallDTO = jobs[i];
			// 	try {
			// 		page = await this.goto(browser, job.url, page);
			// 		let detail!: JobDetailDTO;
			// 		if (job.url.includes('topcv.vn/viec-lam')) detail = await this.crawlJobDetail(page, job);
			// 		else if (job.url.includes('topcv.vn/brand'))
			// 			detail = await this.crawlJobDetailForBrandPage(page, job);

			// 		if (detail) {
			// 			this.log('info', 'Job crawling completed successfully:');
			// 			this.log('info', detail);
			// 			jobDetails.push(detail);
			// 		}
			// 	} catch (err) {
			// 		this.log('error', `TopCV Crawler - Fail to crawl job detail: ${job.title} - ${job.url}`);
			// 	}
			// }
			 await browser.close();
			 var endTime = performance.now();
			 this.log('info', `Crawling process comleted in ${Math.round((endTime - startTime) / 1000)} seconds `);
			 return jobDetails;
		} catch (err) {
			logger.error(err);
			throw new Error(`Error when crawling website: ${baseUrl} - ${searchUrl}`);
		}
	}

    async launchBrowser(
		baseUrl: string,
		headless: boolean = false,
		windowWidth: number = 1200,
		windowHeight: number = 800
	): Promise<Browser> {
		try {
			const browser = await puppeteer.launch({
				headless,
				defaultViewport: null,
				devtools: false,
				args: [`--window-size=${windowWidth},${windowHeight}`],
			});
			const context = browser.defaultBrowserContext();
			context.overridePermissions(baseUrl, ['geolocation', 'notifications']);

			this.log('info', 'Opening browser');
			return browser;
		} catch (err) {
			logger.error(err);
			throw new Error('Vieclam365 Crawler - Fail to launch browser');
		}
	}


    async goto(browser: Browser, url: string, page?: Page): Promise<Page> {
		try {
			if (!page) page = await browser.newPage();
			await page.goto(url, { waitUntil: 'networkidle2' });
			this.log('info', `Go to page: ${url}`);
			return page;
		} catch (err) {
			logger.error(err);
			throw new Error(`Vieclam365 Crawler - Fail to goto page: ${url}`);
		}
	}

    async search(page: Page, keyword: string): Promise<Page> {
		try {
			await page.waitForSelector('input#fts_id');
			await page.type('input#fts_id', keyword);
			await page.keyboard.press('Enter');

			this.log('info', `Searching: ${keyword}`);
			return page;
		} catch (err) {
			logger.error(err);
			throw new Error(`Vieclam365 Crawler - Fail to search: ${keyword}`);
		}
	}


	async getTotalPageNumber(page: Page): Promise<number> {
		try {
			await page.waitForSelector('div.clr');
			const pagination = await page.$('div.clr');
			if (pagination) {
				const listItems = await pagination.$$('a');
				const lastPageEl = listItems[listItems.length - 2];
				return Number.parseInt(await lastPageEl.evaluate((el) => (el as HTMLElement).innerText));
			}

			return 1;
		} catch (err) {
			logger.error(err);
			throw new Error(`TimViec365 Crawler - Fail to get total page number`);
		}
	}

	async crawlAllJobs(page: Page, totalPage?: number): Promise<JobOverallDTO[]> {
		try {
			let isNextPage = false;
			const arrJobs: JobOverallDTO[] = [];
			let currentPage: string | undefined;

			const isEmptyEl = await page.$('div.clr');
			if (!isEmptyEl) {
				this.log('info', `Crawl All Job - There's no result that match with your keyword`);
				return [];
			}

			do {
				await page.waitForSelector('div.clr');
				const pagination = await page.$('div.clr');

				if (!pagination) this.log('info', `Crawl All Job - Page: 1(No pagination) processing...`);
				else {
					const currentPageEl = await pagination.$('a.jp-current');
					currentPage = await currentPageEl?.evaluate((el) => (el as HTMLElement).innerText);
					this.log('info', `Page: ${currentPage}/${totalPage || '_'} processing...`);
				}

				const jobs = await page.$$('div.clr');
				this.log('info', `Crawl All Job - Page ${currentPage} - Total: ${jobs.length} jobs`);

				const jobInfos = await Promise.all(
					jobs.map(async (job) => {
						const jobInfo = await job.evaluate((el) => {
							const wrapperEl = el.querySelector('div..center_cate_l');
							const urlEl = wrapperEl?.querySelector('h3 a.title_cate');
							const titleEl = wrapperEl?.querySelector('h3 a.title_cate');

							const url = urlEl ? urlEl.getAttribute('href') : '';
							const title = titleEl ? titleEl.getAttribute('title') : '';

							// return new Job(url, title);
							return { url, title } as JobOverallDTO;
						});
						this.log('info', jobInfo);
						return jobInfo;
					})
				);

				arrJobs.push(...jobInfos);

				let nextPageEl;
				if (pagination) {
					nextPageEl = await pagination.$('a:last-child');
					if (!nextPageEl) throw new Error('Không tìm thấy next page');

					isNextPage = !(await nextPageEl.evaluate((el) => (el.classList.contains(' next') || el.classList.contains(' last'))));
				}

				if (isNextPage && nextPageEl) await nextPageEl.click();
				// else await page.close();
			} while (isNextPage);

			return arrJobs;
		} catch (err) {
			logger.error(err);
			this.log('error', `TimViec365 Crawler - Fail to crawl all jobs`, true);
			throw new Error(`TimViec365 Crawler - Fail to crawl all jobs`);
		}
	}
}
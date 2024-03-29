export class CompanyDTO {
	constructor(
		public url: string,
		public name: string,
		public address: string,
		public imageUrl: string
	) {}

	get normalizedName() {
		return this.name;
	}
}
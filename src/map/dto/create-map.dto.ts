import { Case, Configuration, House } from '../map.schema';

export class CreateMapDto {
  name: string;
  houses: House[];
  cases: Case[];
  configuration: Configuration;
}

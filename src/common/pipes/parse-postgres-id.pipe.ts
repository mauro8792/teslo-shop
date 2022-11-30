import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParsePostgresIdPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    
    return value;
  }
}

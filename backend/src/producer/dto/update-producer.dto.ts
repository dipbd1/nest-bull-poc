import { PartialType } from '@nestjs/mapped-types';
import { CreateProducerDto } from './create-producer.dto.js';

export class UpdateProducerDto extends PartialType(CreateProducerDto) {}

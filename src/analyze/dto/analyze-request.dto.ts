import { IsString, IsUUID, MaxLength, IsNotEmpty } from 'class-validator';

/**
 * Request DTO for /analyze endpoint
 * Validates incoming analysis requests
 */
export class AnalyzeRequestDto {
  @IsUUID('4', { message: 'parentID must be a valid UUID' })
  parentID: string;

  @IsUUID('4', { message: 'customerID must be a valid UUID' })
  customerID: string;

  @IsString({ message: 'senderID must be a string' })
  @IsNotEmpty({ message: 'senderID should not be empty' })
  senderID: string;

  @IsString({ message: 'content must be a string' })
  @IsNotEmpty({ message: 'content should not be empty' })
  @MaxLength(2000, { message: 'content must be shorter than or equal to 2000 characters' })
  content: string;

  @IsUUID('4', { message: 'messageID must be a valid UUID' })
  messageID: string;
}

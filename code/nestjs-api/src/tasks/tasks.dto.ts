import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export type TaskStatus = "open" | "in_progress" | "done";

export class CreateTaskDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @IsOptional()
  @IsEnum(["open", "in_progress", "done"])
  status?: TaskStatus;
}

export class UpdateTaskDto {
  @IsOptional() @IsString() @Length(1, 200) title?: string;
  @IsOptional() @IsString() @Length(0, 2000) description?: string;
  @IsOptional() @IsEnum(["open", "in_progress", "done"]) status?: TaskStatus;
}

export class ListTasksQueryDto {
  @IsOptional() @IsEnum(["open", "in_progress", "done"]) status?: TaskStatus;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 20;
}

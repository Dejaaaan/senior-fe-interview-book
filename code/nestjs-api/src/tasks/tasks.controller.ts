import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { TasksService } from "./tasks.service";
import {
  CreateTaskDto,
  ListTasksQueryDto,
  UpdateTaskDto,
} from "./tasks.dto";

@Controller("tasks")
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@Query() query: ListTasksQueryDto) {
    return this.tasks.list(query);
  }

  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.tasks.create(dto);
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.tasks.get(id);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  delete(@Param("id", ParseUUIDPipe) id: string) {
    this.tasks.delete(id);
  }
}

import { TypedBody, TypedParam, TypedRoute } from '@nestia/core';
import { Controller, HttpCode, HttpStatus } from '@nestjs/common';
import {
  CreateIntakeResponse,
  DeleteIntakeResponse,
  FindAllActiveIntakesResponse,
  FindAllIntakesResponse,
  FindByIdIntakeResponse,
  ResetToDefaultResponse,
  UpdateIntakeResponse,
} from './dto';
import { CreateIntakeDto } from './dto/create-intake.dto';
import { UpdateIntakeDto } from './dto/update-intake.dto';
import { IntakesService } from './intakes.service';

@Controller('intakes')
export class IntakesController {
  constructor(private readonly intakesService: IntakesService) {}

  /**
   * Get all intakes with pagination and filtering
   * @summary Get all intakes
   * @tag intakes
   */
  @TypedRoute.Get()
  async findAll(): Promise<FindAllIntakesResponse> {
    return this.intakesService.findAll();
  }

  /**
   * Get all active intakes without pagination
   * @summary Get all active intakes
   * @tag intakes
   */
  @TypedRoute.Get('all')
  async findAllActive(): Promise<FindAllActiveIntakesResponse> {
    return this.intakesService.findAllActive();
  }

  /**
   * Get intake by ID
   * @summary Get intake by ID
   * @tag intakes
   */
  @TypedRoute.Get(':id')
  async findById(
    @TypedParam('id') id: string,
  ): Promise<FindByIdIntakeResponse> {
    return this.intakesService.findById(id);
  }

  /**
   * Create a new intake
   * @summary Create a new intake
   * @tag intakes
   */
  @TypedRoute.Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @TypedBody() createIntakeDto: CreateIntakeDto,
  ): Promise<CreateIntakeResponse> {
    return this.intakesService.create(createIntakeDto);
  }

  /**
   * Update an intake
   * @summary Update an intake
   * @tag intakes
   */
  @TypedRoute.Put(':id')
  async update(
    @TypedParam('id') id: string,
    @TypedBody() updateIntakeDto: UpdateIntakeDto,
  ): Promise<UpdateIntakeResponse> {
    return this.intakesService.update(id, updateIntakeDto);
  }

  /**
   * Delete an intake (only custom intakes can be deleted)
   * @summary Delete an intake
   * @tag intakes
   */
  @TypedRoute.Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@TypedParam('id') id: string): Promise<DeleteIntakeResponse> {
    await this.intakesService.delete(id);
  }

  /**
   * Reset intakes to default (preseeded)
   * @summary Reset intakes to default
   * @tag intakes
   */
  @TypedRoute.Post('reset')
  async resetToDefault(): Promise<ResetToDefaultResponse> {
    await this.intakesService.resetToDefault();
    return { message: 'Intakes reset to default successfully' };
  }
}

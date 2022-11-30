import { NotFoundException } from '@nestjs/common';
import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { validate as isUUID } from 'uuid';

import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { DataSource, Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

import { ProductImage, Product } from './entities';
import { User } from 'src/auth/entities/user.entity';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger('ProductsService');

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(Product)
    private readonly productImageRepository: Repository<ProductImage>,

    private readonly dataSource: DataSource,
  ) {}

  async create(createProductDto: CreateProductDto, user: User) {
    try {
      const { images = [], ...producDetails } = createProductDto;
      

      const product = this.productRepository.create({
        ...producDetails,
        images: this.createImage(images),
        user
      });


      await this.productRepository.save(product);

      return { ...product, images };
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async findAll(paginationDto: PaginationDto) {
    try {
      const { limit = 10, offset = 0 } = paginationDto;
      const products = await this.productRepository.find({
        take: limit,
        skip: offset,
        relations: {
          images: true,
        },
      });
      return products.map((p) => ({
        ...p,
        images: p.images.map((i) => i.url),
      }));
    } catch (error) {
      console.log('error', error);
    }
  }

  async findOne(term: string) {
    let product: Product;

    if (isUUID(term)) {
      product = await this.productRepository.findOneBy({ id: term });
    } else {
      const queryBuilder = this.productRepository.createQueryBuilder('prod');
      product = await queryBuilder
        .where(`UPPER(title) = :title or slug =:slug`, {
          title: term.toUpperCase(),
          slug: term.toLocaleLowerCase(),
        })
        .leftJoinAndSelect('prod.images', 'prodImages')
        .getOne();
    }

    if (!product)
      throw new NotFoundException(
        `Product with id, name or no "${term}" not found`,
      );

    return product
  }

  async update(id: string, updateProductDto: UpdateProductDto, user: User) {
    const { images, ...toUpdate } = updateProductDto;

    const product = await this.productRepository.preload({
      id,
      ...toUpdate,
    });

    if (!product)
      throw new NotFoundException(`Product with id: "${id}" not found`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (images) {
        await queryRunner.manager.delete(ProductImage, { product: { id } });

        product.images = this.createImage(images);
      } else {
        product.images = await this.productImageRepository.findBy({
          product: { id },
        });
      }
      product.user = user
      await queryRunner.manager.save(product);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      // await this.productRepository.save(product);
      return { ...product, images };
    } catch (error) {
      await queryRunner.commitTransaction();
      await queryRunner.release();
      this.handleDBExceptions(error);
    }
  }

  async remove(id: string) {
    const product = await this.findOne(id) 
    await this.productRepository.remove(product);

    
  }

  private handleDBExceptions(error: any) {
    this.logger.error(error.detail);
    if (error.code === '23505')
      throw new BadRequestException(`${error.detail} `);
    throw new InternalServerErrorException('Ayuda!');
  }

  private createImage(imagesPayload: string[]) {
    const images = imagesPayload.map((image) => {
      const imageNew = new ProductImage();
      imageNew.url = image;
      return imageNew;
    });

    return images;
  }

  async deleteAllProducts(){
    const query = this.productRepository.createQueryBuilder('product')

    try {
      return await query.delete().where({}).execute()
    } catch (error) {
      this,this.handleDBExceptions(error)
    }
  }
}

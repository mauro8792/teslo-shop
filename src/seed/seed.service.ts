import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/auth/entities/user.entity';
import { ProductsService } from 'src/products/products.service';
import { Repository } from 'typeorm';
import { initialData } from './data/seed-data';
@Injectable()
export class SeedService {
  constructor(
    private readonly productservice: ProductsService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async runSeed() {
    await this.deleteTables();

    const adminUsers = await this.insertUsers();
    await this.insertNewProducts(adminUsers);
    return `This action returns all seed`;
  }

  private async insertUsers() {
    const seedUsers = initialData.users;

    const users: User[] = [];

    seedUsers.forEach((u) => {
      users.push(this.userRepository.create(u));
    });

    const dbUsers = await this.userRepository.save(seedUsers);

    return dbUsers[0];
  }

  private async deleteTables() {
    await this.productservice.deleteAllProducts();

    const queryBuilder = this.userRepository.createQueryBuilder();
    await queryBuilder.delete().where({}).execute();
  }

  private async insertNewProducts(user: User) {
    await this.productservice.deleteAllProducts();

    const products = initialData.products;
    const insertPromises = [];
    products.forEach((p) => {
      insertPromises.push(this.productservice.create(p, user));
    });

    await Promise.all(insertPromises);

    return true;
  }
}

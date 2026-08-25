import { Injectable, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from './schema/product.schema';

const SAMPLE_PRODUCTS: Array<Pick<Product, 'name' | 'price'>> = [
  { name: 'Wireless Mouse', price: 12000 },
  { name: 'Mechanical Keyboard', price: 35000 },
  { name: 'USB-C Hub', price: 18000 },
  { name: 'Laptop Stand', price: 15000 },
  { name: 'Noise-Cancelling Headphones', price: 65000 },
  { name: 'Webcam', price: 28000 },
  { name: 'Portable SSD', price: 55000 },
  { name: 'Bluetooth Speaker', price: 22000 },
  { name: 'Power Bank', price: 25000 },
  { name: 'Smartwatch', price: 45000 },
];

@Injectable()
export class ProductService implements OnModuleInit {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
  ) {}

  async onModuleInit(): Promise<void> {
    const productCount = await this.productModel.countDocuments();

    if (productCount === 0) {
      await this.productModel.insertMany(SAMPLE_PRODUCTS);
    }
  }

  async getProducts(): Promise<Product[]> {
    const products = await this.productModel.find().lean();
    return products;
  }
}

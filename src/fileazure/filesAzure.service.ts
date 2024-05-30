import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FilesAzureService {
  constructor(private readonly configService: ConfigService) {}
  private containerName: string;
  private authorizeExtension = ['jpg', 'jpeg', 'png', 'webp'];

  private async getBlobServiceInstance() {
    const connectionString = this.configService.get('CONNECTION_STRING');
    console.log(connectionString);
    const blobClientService =
      await BlobServiceClient.fromConnectionString(connectionString);
    return blobClientService;
  }

  private async getBlobClient(imageName: string): Promise<BlockBlobClient> {
    const blobService = await this.getBlobServiceInstance();
    const containerName = this.containerName;
    const containerClient = blobService.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(imageName);

    return blockBlobClient;
  }

  public async uploadFile(file: Express.Multer.File, containerName: string) {
    this.containerName = containerName;
    const extension = file.originalname.split('.').pop();
    if (this.authorizeExtension.includes(extension) === false) {
      throw new BadRequestException('Invalid file extension');
    }
    const file_name = uuidv4() + '.' + extension;
    const compressedFilePath = `compressed-${file_name}`;

    let quality = 80;
    let buffer = file.buffer;
    let info;

    do {
      const result = await sharp(buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality })
        .toBuffer({ resolveWithObject: true })
        .then((data) => {
          console.log(data);
          return data;
        });

      buffer = result.data;
      info = result.info;

      quality -= 10;
    } while (buffer.length / 1024 > 100 && quality > 10);

    const blockBlobClient = await this.getBlobClient(file_name);
    const fileUrl = blockBlobClient.url;
    await blockBlobClient.uploadData(buffer);

    return fileUrl;
  }

  public async deleteFile(fileUrl: string, containerName: string) {
    if (fileUrl) {
      const fileName = fileUrl.split('/').pop();
      this.containerName = containerName;
      const blockBlobClient = await this.getBlobClient(fileName);
      await blockBlobClient.deleteIfExists();
    }
  }
}

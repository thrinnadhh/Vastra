import { Module } from '@nestjs/common';

import { WardrobeUploadController } from './wardrobe-upload.controller';
import { SupabaseWardrobeUploadGateway } from './wardrobe-upload.gateway';
import { WardrobeUploadService } from './wardrobe-upload.service';
import { WARDROBE_UPLOAD_GATEWAY } from './wardrobe-upload.tokens';

@Module({
  controllers: [WardrobeUploadController],
  providers: [
    WardrobeUploadService,
    {
      provide: WARDROBE_UPLOAD_GATEWAY,
      useClass: SupabaseWardrobeUploadGateway,
    },
  ],
})
export class WardrobeModule {}

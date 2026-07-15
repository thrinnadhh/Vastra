import { Module } from '@nestjs/common';

import { WardrobeItemController } from './wardrobe-item.controller';
import { WardrobeItemCreateService } from './wardrobe-item-create.service';
import { WardrobeItemManagementService } from './wardrobe-item-management.service';
import { WardrobeStorageDeletionProcessor } from './wardrobe-storage-deletion.processor';
import { SupabaseWardrobeGateway } from './wardrobe.gateway';
import { WARDROBE_GATEWAY } from './wardrobe.tokens';
import { WardrobeUploadController } from './wardrobe-upload.controller';
import { SupabaseWardrobeUploadGateway } from './wardrobe-upload.gateway';
import { WardrobeUploadService } from './wardrobe-upload.service';
import { WARDROBE_UPLOAD_GATEWAY } from './wardrobe-upload.tokens';

@Module({
  controllers: [WardrobeUploadController, WardrobeItemController],
  providers: [
    WardrobeUploadService,
    WardrobeItemCreateService,
    WardrobeItemManagementService,
    WardrobeStorageDeletionProcessor,
    { provide: WARDROBE_UPLOAD_GATEWAY, useClass: SupabaseWardrobeUploadGateway },
    { provide: WARDROBE_GATEWAY, useClass: SupabaseWardrobeGateway },
  ],
})
export class WardrobeModule {}

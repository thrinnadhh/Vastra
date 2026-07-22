import { Module } from '@nestjs/common';
import { CustomerAddressController } from './customer-address.controller';
import { SupabaseCustomerAddressGateway } from './customer-address.gateway';
import { CustomerAddressService } from './customer-address.service';
import { CUSTOMER_ADDRESS_GATEWAY } from './customer-address.tokens';

@Module({
  controllers: [CustomerAddressController],
  providers: [
    CustomerAddressService,
    SupabaseCustomerAddressGateway,
    { provide: CUSTOMER_ADDRESS_GATEWAY, useExisting: SupabaseCustomerAddressGateway },
  ],
})
export class CustomerAddressModule {}

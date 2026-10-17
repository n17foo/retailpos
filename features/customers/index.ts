export { default as CustomersScreen } from './screens/CustomersScreen';
export { default as CustomerProfileScreen } from './screens/CustomerProfileScreen';
export { default as CustomerSearchModal } from './components/CustomerSearchModal';
export { useCustomerSearch } from './hooks/useCustomerSearch';
export { useCustomerProfile } from './hooks/useCustomerProfile';
export { CustomerServiceFactory, customerServiceFactory } from './services/customer/CustomerServiceFactory';
export type {
  CustomerServiceInterface,
  PlatformCustomer,
  CustomerSearchOptions,
  CustomerSearchResult,
} from './services/customer/CustomerServiceInterface';
export { LocalCustomerService, localCustomerService } from './services/customer/LocalCustomerService';
export { StoreCreditService, storeCreditService } from './services/customer/StoreCreditService';
export { LoyaltyService, loyaltyService } from './services/loyalty/LoyaltyService';
export { LoyaltyExpiryJob, loyaltyExpiryJob } from './services/loyalty/LoyaltyExpiryJob';
export { LocalCustomerRepository, localCustomerRepository } from './repositories/LocalCustomerRepository';
export { LoyaltyRepository, loyaltyRepository } from './repositories/LoyaltyRepository';
export { StoreCreditRepository, storeCreditRepository } from './repositories/StoreCreditRepository';

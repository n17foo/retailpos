export interface ProductFormData {
  title: string;
  description: string;
  price: string;
  sku: string;
  barcode: string;
  stock: string;
  categoryId: string;
  imageUrl: string;
}

export const EMPTY_PRODUCT_FORM: ProductFormData = {
  title: '',
  description: '',
  price: '',
  sku: '',
  barcode: '',
  stock: '',
  categoryId: '',
  imageUrl: '',
};

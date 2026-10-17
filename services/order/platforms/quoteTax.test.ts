/* eslint-disable @typescript-eslint/no-explicit-any -- stubbing raw platform API responses */
import type { Order } from '../OrderServiceInterface';
import { WooCommerceOrderService } from './WooCommerceOrderService';
import { MagentoOrderService } from './MagentoOrderService';
import { BigCommerceOrderService } from './BigCommerceOrderService';
import { SyliusOrderService } from './SyliusOrderService';
import { PrestaShopOrderService } from './PrestaShopOrderService';
import { ShopifyOrderService } from './ShopifyOrderService';
import { WooCommerceApiClient } from '../../clients/woocommerce/WooCommerceApiClient';
import { MagentoApiClient } from '../../clients/magento/MagentoApiClient';
import { BigCommerceApiClient } from '../../clients/bigcommerce/BigCommerceApiClient';
import { SyliusApiClient } from '../../clients/sylius/SyliusApiClient';
import { PrestaShopApiClient } from '../../clients/prestashop/PrestaShopApiClient';

const order = (lines: Array<Partial<Order['lineItems'][0]>> = [{}]): Order => ({
  lineItems: lines.map((line, i) => ({
    productId: `${10 + i}`,
    variantId: undefined,
    sku: `SKU-${i}`,
    name: `Item ${i}`,
    quantity: 2,
    price: 10,
    total: 20,
    ...line,
  })),
  subtotal: 20,
  tax: 0,
  total: 20,
});

const ready = <T extends object>(service: T): T => {
  (service as any).initialized = true;
  return service;
};

afterEach(() => jest.restoreAllMocks());

describe('WooCommerce quoteTax', () => {
  it('creates a pending order, reads the calculated tax and deletes the order', async () => {
    const client = WooCommerceApiClient.getInstance();
    const post = jest.spyOn(client, 'post').mockResolvedValue({
      id: 77,
      total_tax: '4.00',
      prices_include_tax: false,
      line_items: [{ total: '20.00' }],
    });
    const del = jest.spyOn(client, 'delete').mockResolvedValue({});

    const quote = await ready(new WooCommerceOrderService()).quoteTax(order());

    expect(quote).toEqual({ subtotal: 20, tax: 4, taxIncluded: false });
    expect(post).toHaveBeenCalledWith(
      'orders',
      expect.objectContaining({ status: 'pending', line_items: [{ product_id: 10, variation_id: undefined, quantity: 2 }] })
    );
    expect(del).toHaveBeenCalledWith('orders/77?force=true');
  });

  it('sends a variation only when it differs from the product', async () => {
    const client = WooCommerceApiClient.getInstance();
    const post = jest.spyOn(client, 'post').mockResolvedValue({ id: 1, total_tax: '0', line_items: [] });
    jest.spyOn(client, 'delete').mockResolvedValue({});

    await ready(new WooCommerceOrderService()).quoteTax(order([{ productId: '10', variantId: '55' }]));

    expect((post.mock.calls[0][1] as any).line_items[0].variation_id).toBe(55);
  });

  it('reports tax-inclusive store prices', async () => {
    const client = WooCommerceApiClient.getInstance();
    jest.spyOn(client, 'post').mockResolvedValue({ id: 1, total_tax: '3.33', prices_include_tax: true, line_items: [{ total: '16.67' }] });
    jest.spyOn(client, 'delete').mockResolvedValue({});

    const quote = await ready(new WooCommerceOrderService()).quoteTax(order());
    expect(quote.taxIncluded).toBe(true);
  });

  it('deletes the pending order even when reading it fails', async () => {
    const client = WooCommerceApiClient.getInstance();
    jest.spyOn(client, 'post').mockResolvedValue({ id: 9, total_tax: '1', line_items: null });
    const del = jest.spyOn(client, 'delete').mockResolvedValue({});

    await ready(new WooCommerceOrderService()).quoteTax(order());
    expect(del).toHaveBeenCalledWith('orders/9?force=true');
  });
});

describe('Magento quoteTax', () => {
  it('adds the items to a guest quote and reads net subtotal and tax from its totals', async () => {
    const client = MagentoApiClient.getInstance();
    const post = jest.spyOn(client, 'post').mockResolvedValueOnce('masked-cart').mockResolvedValue({});
    jest.spyOn(client, 'get').mockResolvedValue({
      subtotal: 20,
      tax_amount: 4,
      items: [{ price: 10, price_incl_tax: 12 }],
    });

    const quote = await ready(new MagentoOrderService()).quoteTax(order());

    expect(quote).toEqual({ subtotal: 20, tax: 4, taxIncluded: false });
    expect(post).toHaveBeenCalledWith('guest-carts/masked-cart/items', { cartItem: { sku: 'SKU-0', qty: 2, quote_id: 'masked-cart' } });
  });

  it('detects tax-inclusive catalogue prices from the item prices', async () => {
    const client = MagentoApiClient.getInstance();
    jest.spyOn(client, 'post').mockResolvedValueOnce('c').mockResolvedValue({});
    jest.spyOn(client, 'get').mockResolvedValue({ subtotal: 16.67, tax_amount: 3.33, items: [{ price: 8.33, price_incl_tax: 10 }] });

    const quote = await ready(new MagentoOrderService()).quoteTax(order());
    expect(quote.taxIncluded).toBe(true);
  });
});

describe('BigCommerce quoteTax', () => {
  it('reads checkout totals for a temporary cart and deletes the cart', async () => {
    const client = BigCommerceApiClient.getInstance();
    const post = jest.spyOn(client, 'post').mockResolvedValue({ data: { id: 'cart-1' } });
    jest.spyOn(client, 'get').mockResolvedValue({ data: { subtotal_ex_tax: 20, tax_total: 4, cart: { tax_included: false } } });
    const del = jest.spyOn(client, 'delete').mockResolvedValue({});

    const quote = await ready(new BigCommerceOrderService()).quoteTax(order([{ variantId: '123' }]));

    expect(quote).toEqual({ subtotal: 20, tax: 4, taxIncluded: false });
    expect(post).toHaveBeenCalledWith('carts', { line_items: [{ quantity: 2, product_id: 10, variant_id: 123 }] });
    expect(del).toHaveBeenCalledWith('carts/cart-1');
  });

  it('omits the synthetic variant id of products without variants', async () => {
    const client = BigCommerceApiClient.getInstance();
    const post = jest.spyOn(client, 'post').mockResolvedValue({ data: { id: 'c' } });
    jest.spyOn(client, 'get').mockResolvedValue({ data: { subtotal_ex_tax: 0, tax_total: 0 } });
    jest.spyOn(client, 'delete').mockResolvedValue({});

    await ready(new BigCommerceOrderService()).quoteTax(order([{ variantId: '10-default' }]));
    expect((post.mock.calls[0][1] as any).line_items[0].variant_id).toBeUndefined();
  });
});

describe('Sylius quoteTax', () => {
  it('reads tax from a temporary cart (minor units) and deletes it', async () => {
    const client = SyliusApiClient.getInstance();
    jest.spyOn(client, 'post').mockResolvedValueOnce({ tokenValue: 'tok' }).mockResolvedValue({});
    jest.spyOn(client, 'get').mockResolvedValue({ itemsTotal: 2000, taxTotal: 400, taxExcludedTotal: 400, taxIncludedTotal: 0 });
    const del = jest.spyOn(client, 'delete').mockResolvedValue({});

    const quote = await ready(new SyliusOrderService()).quoteTax(order());

    expect(quote).toEqual({ subtotal: 20, tax: 4, taxIncluded: false });
    expect(del).toHaveBeenCalledWith('orders/tok');
  });

  it('reports included tax and the net subtotal', async () => {
    const client = SyliusApiClient.getInstance();
    jest.spyOn(client, 'post').mockResolvedValueOnce({ tokenValue: 'tok' }).mockResolvedValue({});
    jest.spyOn(client, 'get').mockResolvedValue({ itemsTotal: 2000, taxTotal: 333, taxExcludedTotal: 0, taxIncludedTotal: 333 });
    jest.spyOn(client, 'delete').mockResolvedValue({});

    const quote = await ready(new SyliusOrderService()).quoteTax(order());
    expect(quote).toEqual({ subtotal: 16.67, tax: 3.33, taxIncluded: true });
  });
});

describe('PrestaShop quoteTax', () => {
  it("sums the platform's own tax-inclusive and tax-exclusive prices per line", async () => {
    const client = PrestaShopApiClient.getInstance();
    const get = jest.spyOn(client, 'get').mockResolvedValue({ product: { with_tax: 12, no_tax: 10 } });

    const quote = await ready(new PrestaShopOrderService()).quoteTax(order([{ variantId: '7' }]));

    expect(quote).toEqual({ subtotal: 20, tax: 4, taxIncluded: false });
    expect(get).toHaveBeenCalledWith(
      'products/10',
      expect.objectContaining({ 'price[with_tax][use_tax]': '1', 'price[no_tax][use_tax]': '0', 'price[with_tax][product_attribute]': '7' })
    );
  });

  it('fails when PrestaShop does not return a calculated price', async () => {
    jest.spyOn(PrestaShopApiClient.getInstance(), 'get').mockResolvedValue({ product: {} });
    await expect(ready(new PrestaShopOrderService()).quoteTax(order())).rejects.toThrow('did not return a tax-calculated price');
  });
});

describe('platforms without a quote', () => {
  it('refuse to quote so a sale is never priced with an invented tax', async () => {
    await expect(ready(new ShopifyOrderService()).quoteTax(order())).rejects.toThrow('cannot calculate tax');
  });
});

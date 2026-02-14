// server/src/utils/trackingUtils.ts
import { OrderStatus } from '@prisma/client'

/**
 * Map Nova Poshta status to our OrderStatus enum
 * Based on official Nova Poshta API documentation
 *
 * This is a shared utility used by:
 * - orderTrackingController (manual updates)
 * - trackingStatusCronJob (automated updates)
 */
export function mapNovaPoshtaStatusToOrderStatus(
  novaPoshtaStatus: string,
  statusCode: string,
): OrderStatus {
  const status = novaPoshtaStatus.toLowerCase()

  // Code 9: Delivered (Видалено / Отримано)
  if (
    status.includes('одержано') ||
    status.includes('отримано') ||
    status.includes('delivered') ||
    status.includes('получено') ||
    statusCode === '9'
  ) {
    return OrderStatus.DELIVERED
  }

  // Code 5: En route to city (Відправлення прямує до міста YYYY)
  // Code 6: En route to city with expected delivery date (Відправлення у місті YYYY, орієнтовна доставка до ВІДДІЛЕННЯ-ХХХ dd-mm)
  if (
    status.includes('прямує до міста') ||
    status.includes('відправлення у місті') ||
    status.includes('орієнтовна доставка') ||
    status.includes('в дорозі') ||
    statusCode === '5' ||
    statusCode === '6'
  ) {
    return OrderStatus.SHIPPED
  }

  // Code 7: Arrived at branch (Прибув на відділення)
  // Code 8: Arrived at branch (reserved in Postomat) (Прибув на відділення (завантажено в Поштомат))
  if (
    status.includes('прибув на відділення') ||
    status.includes('готове до видачі') ||
    status.includes('awaiting') ||
    status.includes('arrived') ||
    statusCode === '7' ||
    statusCode === '8'
  ) {
    return OrderStatus.AWAITING_PICKUP
  }

  // Code 102: Refused by recipient (Відмова від отримання (відправником створено замовлення на повернення))
  // Code 103: Refused by recipient (Відмова від отримання)
  if (
    status.includes('відмова від отримання') ||
    status.includes('відмова') ||
    status.includes('refused') ||
    statusCode === '102' ||
    statusCode === '103'
  ) {
    return OrderStatus.CANCELED
  }

  // Code 10: Return received %DateReceived% (Відправлення отримано %DateReceived%. Грошовий переказ видано одержувачу)
  // Code 11: Return received %DateReceived% (Відправлення отримано %DateReceived%. Грошовий переказ видано одержувачу)
  // Code 101: On the way to recipient (На шляху до одержувача)
  if (
    status.includes('повернення') ||
    status.includes('return') ||
    status.includes('на шляху до одержувача') ||
    statusCode === '10' ||
    statusCode === '11' ||
    statusCode === '101'
  ) {
    return OrderStatus.RETURN
  }

  // Code 104: Address changed (Змінено адресу)
  // Code 105: Stopped storage (Припинено зберігання)
  // Code 106: Received and created EN reverse delivery (Одержано і створено ЕН зворотної доставки)
  if (statusCode === '104' || statusCode === '105' || statusCode === '106') {
    return OrderStatus.RETURN
  }

  // Code 1: Self-paced shipper is creating but not yet delivered (Відправник самостійно створює що накладну, але ще не надав до відправки)
  // Code 2: Removed (Видалено)
  // Code 3: Number not found (Номер не знайдено)
  // Code 4: Shipment in city XXXX (Відправлення у місті ХХХХ (статус для міжобласних відправлень))
  if (
    statusCode === '1' ||
    statusCode === '2' ||
    statusCode === '3' ||
    statusCode === '4'
  ) {
    return OrderStatus.PREPARED
  }

  // Code 41: Shipment in city XXXX (Відправлення у місті ХХХХ (статус для послуг «Локал стандарт» і «Локал експрес» — доставка в межах міста))
  if (statusCode === '41') {
    return OrderStatus.SHIPPED
  }

  // Code 111: Failed delivery attempt due to recipient absence or connection (Невдала спроба доставки через відсутність одержувача на адресі або зв'язку з ним)
  // Code 112: Delivery date postponed by recipient (Дата доставки перенесена одержувачем)
  if (statusCode === '111' || statusCode === '112') {
    return OrderStatus.AWAITING_PICKUP
  }

  // Default to RECEIVED for unknown statuses
  return OrderStatus.RECEIVED
}

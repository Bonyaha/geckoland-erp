//src/services/delivery/novaPoshtaService.ts
import axios from 'axios';
import { config } from '../../config/environment';


const NOVA_POSHTA_API_URL = config.shipping.novaPoshta.baseUrl;
const NOVA_POSHTA_API_KEY = config.shipping.novaPoshta.apiKey;

if (!NOVA_POSHTA_API_KEY) {
  console.warn('⚠️ NOVA_POSHTA_API_KEY is not set in environment variables');
}

/**
 * Nova Poshta tracking document interface (for request)
 */
interface NovaPoshtaTrackingDocument {
  DocumentNumber: string;
  Phone: string;
}

/**
 * Nova Poshta API request payload
 */
interface NovaPoshtaApiPayload {
  apiKey: string;
  modelName: string;
  calledMethod: string;
  methodProperties: {
    Documents: NovaPoshtaTrackingDocument[];
  };
}

/**
 * Nova Poshta tracking status response (ACTUAL API RESPONSE)
 */
interface NovaPoshtaTrackingStatus {
  PossibilityCreateReturn: boolean;
  PossibilityCreateRefusal: boolean;
  PossibilityChangeEW: boolean;
  PossibilityCreateRedirecting: boolean;
  Number: string;
  Redelivery: string;
  RedeliverySum: string;
  RedeliveryNum: string;
  RedeliveryPayer: string;
  OwnerDocumentType: string;
  LastCreatedOnTheBasisDocumentType: string;
  LastCreatedOnTheBasisPayerType: string;
  LastCreatedOnTheBasisDateTime: string;
  LastTransactionStatusGM: string;
  LastTransactionDateTimeGM: string;
  LastAmountTransferGM: string;
  DateCreated: string;
  DocumentWeight: string;
  FactualWeight: string;
  VolumeWeight: string;
  CheckWeight: string;
  CheckWeightMethod: string;
  DocumentCost: string;
  CalculatedWeight: string;
  SumBeforeCheckWeight: string;
  PayerType: string;
  RecipientFullName: string;
  RecipientDateTime: string;
  ScheduledDeliveryDate: string;
  PaymentMethod: string;
  CargoDescriptionString: string;
  CargoType: string;
  CitySender: string;
  CityRecipient: string;
  WarehouseRecipient: string;
  CounterpartyType: string;
  AfterpaymentOnGoodsCost: string;
  ServiceType: string;
  UndeliveryReasonsSubtypeDescription: string;
  WarehouseRecipientNumber: string;
  LastCreatedOnTheBasisNumber: string;
  PhoneRecipient: string;
  RecipientFullNameEW: string;
  WarehouseRecipientInternetAddressRef: string;
  MarketplacePartnerToken: string;
  ClientBarcode: string;
  RecipientAddress: string;
  CounterpartyRecipientDescription: string;
  CounterpartySenderType: string;
  DateScan: string;
  PaymentStatus: string;
  PaymentStatusDate: string;
  AmountToPay: string;
  AmountPaid: string;
  Status: string;
  StatusCode: string;
  RefEW: string;
  BackwardDeliverySubTypesActions: string;
  BackwardDeliverySubTypesServices: string;
  UndeliveryReasons: string;
  DatePayedKeeping: string;
  InternationalDeliveryType: string;
  SeatsAmount: string;
  CardMaskedNumber: string;
  ExpressWaybillPaymentStatus: string;
  ExpressWaybillAmountToPay: string;
  PhoneSender: string;
  TrackingUpdateDate: string;
  WarehouseSender: string;
  DateReturnCargo: string;
  DateMoving: string;
  DateFirstDayStorage: string;
  RefCityRecipient: string;
  RefCitySender: string;
  RefSettlementRecipient: string;
  RefSettlementSender: string;
  SenderAddress: string;
  SenderFullNameEW: string;
  AnnouncedPrice: string;
  AdditionalInformationEW: string;
  ActualDeliveryDate: string;
  PostomatV3CellReservationNumber: string;
  OwnerDocumentNumber: string;
  LastAmountReceivedCommissionGM: string;
  DeliveryTimeframe: string;
  CreatedOnTheBasis: string;
  UndeliveryReasonsDate: string;
  RecipientWarehouseTypeRef: string;
  WarehouseRecipientRef: string;
  CategoryOfWarehouse: string;
  WarehouseRecipientAddress: string;
  WarehouseSenderInternetAddressRef: string;
  WarehouseSenderAddress: string;
  AviaDelivery: string;
  BarcodeRedBox: string;
  CargoReturnRefusal: string;
  DaysStorageCargo: string;
  Packaging: any[] | null;
  PartialReturnGoods: any[] | null;
  SecurePayment: string;
  PossibilityChangeCash2Card: boolean;
  PossibilityChangeDeliveryIntervals: boolean;
  PossibilityTermExtensio: boolean;
  StorageAmount: string;
  StoragePrice: string;
  FreeShipping: string;
  LoyaltyCardRecipient: string;
}

/**
 * Nova Poshta API response (ACTUAL API RESPONSE)
 */
interface NovaPoshtaApiResponse {
  success: boolean;
  data: NovaPoshtaTrackingStatus[];
  errors: string[];
  warnings: string[];
  info: string[];
  messageCodes: string[];
  errorCodes: string[];
  warningCodes: string[];
  infoCodes: string[];
}

/**
 * Tracking data to update
 */
interface TrackingDataToUpdate {
  trackingNumber: string;
  phoneNumber: string;
  currentStatus?: string;
}

/**
 * Simplified tracking status result for our app
 */
interface UpdatedTrackingStatus {
  trackingNumber: string;
  status: string;
  statusCode: string;
  statusDetails: {
    recipientDateTime?: string;
    scheduledDeliveryDate?: string;
    actualDeliveryDate?: string;
    warehouseRecipient?: string;
    warehouseRecipientNumber?: string;
    cityRecipient?: string;
    citySender?: string;
    recipientFullName?: string;
    recipientAddress?: string;
    undeliveryReasons?: string;
    undeliveryReasonsSubtype?: string;
    dateScan?: string;
    dateCreated?: string;
    trackingUpdateDate?: string;
    cargoDescription?: string;
    documentCost?: string;
    documentWeight?: string;
    seatsAmount?: string;
    paymentMethod?: string;
    afterpaymentOnGoodsCost?: string;
    serviceType?: string;
    datePayedKeeping?: string;
    daysStorageCargo?: string;
    storageAmount?: string;
    storagePrice?: string;
  };
  possibilities: {
    canCreateReturn: boolean;
    canCreateRefusal: boolean;
    canChangeEW: boolean;
    canCreateRedirecting: boolean;
    canChangeCash2Card: boolean;
    canChangeDeliveryIntervals: boolean;
    canTermExtension: boolean;
  };
  updatedAt: Date;
  rawData?: NovaPoshtaTrackingStatus;
}

/**
 * Service for interacting with Nova Poshta tracking API
 */

class NovaPoshtaService {
  private apiUrl: string
  private apiKey: string

  constructor() {
    this.apiUrl = NOVA_POSHTA_API_URL
    this.apiKey = NOVA_POSHTA_API_KEY || ''
  }

  /**
   * Create API payload for tracking status request
   */

  private createApiPayload(
    trackingDocuments: NovaPoshtaTrackingDocument[]
  ): NovaPoshtaApiPayload {
    return {
      apiKey: this.apiKey,
      modelName: 'TrackingDocument',
      calledMethod: 'getStatusDocuments',
      methodProperties: {
        Documents: trackingDocuments,
      },
    }
  }
  /**
   * Fetch tracking statuses from Nova Poshta API
   */
  private async fetchTrackingStatuses(
    payload: NovaPoshtaApiPayload
  ): Promise<NovaPoshtaApiResponse> {
    try {
      console.log(
        `📦 Fetching tracking statuses for ${payload.methodProperties.Documents.length} documents...`
      )

      const response = await axios.post<NovaPoshtaApiResponse>(
        this.apiUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.data.success) {
        console.error(
          '❌ Nova Poshta API returned errors:',
          response.data.errors
        )
        if (response.data.warnings.length > 0) {
          console.warn('⚠️ Warnings:', response.data.warnings)
        }
      }

      return response.data
    } catch (error: any) {
      console.error('❌ Error fetching tracking statuses:', error.message)
      if (error.response) {
        console.error('Response data:', error.response.data)
      }
      throw new Error(`Failed to fetch tracking statuses: ${error.message}`)
    }
  }

  /**
   * Filter tracking data to only include items that need updates
   * Excludes items with empty tracking numbers or certain final statuses
   */

  filterTrackingData(
    trackingData: TrackingDataToUpdate[]
  ): TrackingDataToUpdate[] {
    return trackingData.filter((item) => {
      // Skip if no tracking number
      if (!item.trackingNumber || item.trackingNumber.trim() === '') {
        return false
      }

      // Skip if status is already "Delivered" or other final statuses
      const finalStatuses = [
        'одержано',
        'delivered',
        'получено',
        'отримано',
        'відмова отримувача',
        'повернення відправнику',
        'returned',
      ]

      if (
        item.currentStatus &&
        finalStatuses.some((status) =>
          item.currentStatus?.toLowerCase().includes(status.toLowerCase())
        )
      ) {
        return false
      }

      return true
    })
  }

  /**
   * Parse Nova Poshta date string to Date object
   * Handles formats like "21.11.2021 13:53:47" or "18-11-2021 11:52:42"
   */
  private validateNovaPoshtaDate(dateStr: string): string | undefined {
    if (!dateStr || dateStr === '' || dateStr === '0001-01-01 00:00:00') {
      return undefined
    }
    return dateStr
  }

  /**
   * Map Nova Poshta API response to our simplified format
   */
  private mapToUpdatedStatus(
    item: NovaPoshtaTrackingStatus
  ): UpdatedTrackingStatus {
    return {
      trackingNumber: item.Number,
      status: item.Status || 'В обробці',
      statusCode: item.StatusCode || '',
      statusDetails: {
        recipientDateTime: this.validateNovaPoshtaDate(item.RecipientDateTime),
        scheduledDeliveryDate: this.validateNovaPoshtaDate(
          item.ScheduledDeliveryDate
        ),
        actualDeliveryDate: this.validateNovaPoshtaDate(
          item.ActualDeliveryDate
        ),
        warehouseRecipient: item.WarehouseRecipient || undefined,
        warehouseRecipientNumber: item.WarehouseRecipientNumber || undefined,
        cityRecipient: item.CityRecipient || undefined,
        citySender: item.CitySender || undefined,
        recipientFullName: item.RecipientFullName || undefined,
        recipientAddress: item.RecipientAddress || undefined,
        undeliveryReasons: item.UndeliveryReasons || undefined,
        undeliveryReasonsSubtype:
          item.UndeliveryReasonsSubtypeDescription || undefined,
        dateScan: this.validateNovaPoshtaDate(item.DateScan),
        dateCreated: this.validateNovaPoshtaDate(item.DateCreated),
        trackingUpdateDate: this.validateNovaPoshtaDate(
          item.TrackingUpdateDate
        ),
        cargoDescription: item.CargoDescriptionString || undefined,
        documentCost: item.DocumentCost || undefined,
        documentWeight: item.DocumentWeight || undefined,
        seatsAmount: item.SeatsAmount || undefined,
        paymentMethod: item.PaymentMethod || undefined,
        afterpaymentOnGoodsCost: item.AfterpaymentOnGoodsCost || undefined,
        serviceType: item.ServiceType || undefined,
        datePayedKeeping: this.validateNovaPoshtaDate(item.DatePayedKeeping),
        daysStorageCargo: item.DaysStorageCargo || undefined,
        storageAmount: item.StorageAmount || undefined,
        storagePrice: item.StoragePrice || undefined,
      },
      possibilities: {
        canCreateReturn: item.PossibilityCreateReturn,
        canCreateRefusal: item.PossibilityCreateRefusal,
        canChangeEW: item.PossibilityChangeEW,
        canCreateRedirecting: item.PossibilityCreateRedirecting,
        canChangeCash2Card: item.PossibilityChangeCash2Card,
        canChangeDeliveryIntervals: item.PossibilityChangeDeliveryIntervals,
        canTermExtension: item.PossibilityTermExtensio,
      },
      updatedAt: new Date(),
      rawData: item,
    }
  }

  /**
   * Get tracking statuses for multiple tracking numbers
   */
  async getTrackingStatuses(
    trackingData: TrackingDataToUpdate[]
  ): Promise<UpdatedTrackingStatus[]> {
    if (!this.apiKey) {
      throw new Error('Nova Poshta API key is not configured')
    }

    // Filter out items that don't need updates
    const filteredData = this.filterTrackingData(trackingData)

    if (filteredData.length === 0) {
      console.log('ℹ️ No tracking numbers need updates')
      return []
    }

    console.log(
      `📋 Checking ${filteredData.length} out of ${trackingData.length} tracking numbers`
    )

    // Prepare tracking documents for API
    const trackingDocuments: NovaPoshtaTrackingDocument[] = filteredData.map(
      (item) => ({
        DocumentNumber: item.trackingNumber,
        Phone: item.phoneNumber,
      })
    )

    // Create API payload
    const payload = this.createApiPayload(trackingDocuments)

    // Fetch statuses from API
    const response = await this.fetchTrackingStatuses(payload)

    if (!response.success) {
      throw new Error(`Nova Poshta API failed: ${response.errors.join(', ')}`)
    }

    // Map response to our format
    const updatedStatuses: UpdatedTrackingStatus[] = response.data.map((item) =>
      this.mapToUpdatedStatus(item)
    )

    console.log(
      `✅ Successfully fetched ${updatedStatuses.length} tracking statuses`
    )

    return updatedStatuses
  }

  /**
   * Get tracking status for a single tracking number
   */
  async getSingleTrackingStatus(
    trackingNumber: string,
    phoneNumber: string
  ): Promise<UpdatedTrackingStatus | null> {
    const results = await this.getTrackingStatuses([
      {
        trackingNumber,
        phoneNumber,
      },
    ])

    return results.length > 0 ? results[0] : null
  }

  /**
   * Check if Nova Poshta service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.trim() !== ''
  }
}

// Export singleton instance
export const novaPoshtaService = new NovaPoshtaService();

// Export types
export type {
  TrackingDataToUpdate,
  UpdatedTrackingStatus,
  NovaPoshtaTrackingStatus,
  NovaPoshtaApiResponse,
};
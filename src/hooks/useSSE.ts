'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from '@/types';

interface UseSSEOptions {
  currentUser: User | null;
  onShipmentCreated?: (shipmentNumber: string) => void;
  onShipmentReceived?: () => void;
  onTransactionCreated?: (transactionNumber: string) => void;
}

export function useSSE({ currentUser, onShipmentCreated, onShipmentReceived, onTransactionCreated }: UseSSEOptions) {
  const [connected, setConnected] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const eventSource = new EventSource('/api/realtime/shipments');

    eventSource.onopen = () => setConnected(true);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'PING') return;

        if (payload.type === 'SHIPMENT_CREATED') {
          showToast(`\u{1F514} Notifikasi Kiriman Baru dari HQ: ${payload.shipmentNumber}`);
          onShipmentCreated?.(payload.shipmentNumber);
        } else if (payload.type === 'SHIPMENT_RECEIVED') {
          showToast(`\u2705 Cabang telah memvalidasi penerimaan pengiriman!`);
          onShipmentReceived?.();
        } else if (payload.type === 'TRANSACTION_CREATED') {
          showToast(`\u{1F6D2} Transaksi POS Berhasil: ${payload.transactionNumber}`);
          onTransactionCreated?.(payload.transactionNumber);
        }
      } catch {
        // SSE parse error — ignore
      }
    };

    eventSource.onerror = () => setConnected(false);

    return () => eventSource.close();
  }, [currentUser, onShipmentCreated, onShipmentReceived, onTransactionCreated, showToast]);

  return { connected, toastMessage };
}

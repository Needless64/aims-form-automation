import type { Enquiry } from "@/lib/validation";
import type { DeliveryState } from "@/lib/email/service";

export interface EnquiryRecord {
  referenceId: string;
  enquiry: Enquiry;
  submittedAt: string;
  deliveries: {
    student: DeliveryState;
    admissions: DeliveryState;
  };
}

interface StoredRecord extends EnquiryRecord {
  expiresAt: number;
}

export interface EnquiryStore {
  save(record: EnquiryRecord): void;
  get(referenceId: string): EnquiryRecord | undefined;
  updateDelivery(
    referenceId: string,
    leg: "student" | "admissions",
    state: DeliveryState,
  ): EnquiryRecord | undefined;
}

/**
 * In-memory, single-instance store used to track the two delivery legs and
 * enable a controlled retry of only the failed leg.
 *
 * LIMITATION: records are lost on restart or when another instance handles the
 * retry. Durable delivery tracking requires a database or queue — see README.
 */
export function createMemoryEnquiryStore(
  options: { ttlMs?: number; now?: () => number } = {},
): EnquiryStore {
  const ttlMs = options.ttlMs ?? 48 * 60 * 60 * 1000;
  const now = options.now ?? Date.now;
  const records = new Map<string, StoredRecord>();

  function prune(current: number) {
    if (records.size < 500) return;
    for (const [key, record] of records) {
      if (record.expiresAt <= current) records.delete(key);
    }
  }

  return {
    save(record) {
      const current = now();
      prune(current);
      records.set(record.referenceId, {
        ...record,
        expiresAt: current + ttlMs,
      });
    },
    get(referenceId) {
      const record = records.get(referenceId);
      if (!record) return undefined;
      if (record.expiresAt <= now()) {
        records.delete(referenceId);
        return undefined;
      }
      const { expiresAt: _expiresAt, ...enquiry } = record;
      return enquiry;
    },
    updateDelivery(referenceId, leg, state) {
      const record = records.get(referenceId);
      if (!record || record.expiresAt <= now()) return undefined;
      record.deliveries[leg] = state;
      const { expiresAt: _expiresAt, ...enquiry } = record;
      return enquiry;
    },
  };
}

const globalForStore = globalThis as typeof globalThis & {
  __aimsEnquiryStore?: EnquiryStore;
};

export const enquiryStore: EnquiryStore =
  globalForStore.__aimsEnquiryStore ?? createMemoryEnquiryStore();

if (process.env.NODE_ENV !== "production") {
  globalForStore.__aimsEnquiryStore = enquiryStore;
}

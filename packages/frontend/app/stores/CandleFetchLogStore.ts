import { create } from 'zustand';

export type FetchStatus =
    | 'pending'
    | 'resolved'
    | 'rejected'
    | 'bounced'
    | 'no-data';

export interface FetchRequestLog {
    id: string;
    domain: {
        fromMs: number;
        toMs: number;
    };
    poolInfo: {
        symbol: string;
        period: number;
        platform: string;
    };
    request: {
        time: number;
        caller: string;
        status: FetchStatus;
        reason?: string;
    };
    response?: {
        time: number;
        durationMs: number;
        itemCount: number;
        lastCandleTime: number;
        firstCandleTime: number;
    };
    error?: {
        message: string;
        code?: string;
    };
}

interface LogState {
    candleFetchRequestLog: Array<FetchRequestLog>;
    maxLogs: number;

    createLog: (
        params: Omit<
            FetchRequestLog,
            'id' | 'request' | 'response' | 'error'
        > & {
            caller: string;
        },
    ) => string;

    clearLogs: () => void;

    removeLog: (id: string) => void;

    markResolved: (
        id: string,
        dataLength: number,
        firstCandleTime: number,
        lastCandleTime: number,
    ) => void;
    markRejected: (id: string, error: unknown) => void;
    markNoData: (id: string) => void;
    markBounced: (id: string, reason: string) => void;
    getLogById: (id: string) => FetchRequestLog | undefined;
    getLogsByStatus: (
        status: FetchStatus,
    ) => Array<FetchRequestLog> | undefined;
    getLogsByPool: (
        symbol: string,
        platform: string,
    ) => Array<FetchRequestLog> | undefined;
    getStats: () => any;
    getCaller: (caller: string) => string | undefined;
}

let fetchLogSeq = 0;

function generateFetchLogId() {
    fetchLogSeq += 1;
    return `fetch-log-${Date.now()}-${fetchLogSeq}`;
}

export const useCandleLogStore = create<LogState>((set, get) => ({
    candleFetchRequestLog: [],
    maxLogs: 1000,

    createLog: (params) => {
        const id = generateFetchLogId();
        const now = Date.now();

        const log: FetchRequestLog = {
            id,
            domain: params.domain,
            request: {
                time: now,
                caller: params.caller,
                status: 'pending',
            },
            poolInfo: params.poolInfo,
        };

        set((state) => {
            const newLogs = [...state.candleFetchRequestLog, log];

            const trimmedLogs =
                newLogs.length > state.maxLogs
                    ? newLogs.slice(-state.maxLogs)
                    : newLogs;

            return {
                candleFetchRequestLog: trimmedLogs,
            };
        });

        return id;
    },

    clearLogs: () => set({ candleFetchRequestLog: [] }),

    removeLog: (id: string) =>
        set((state) => ({
            candleFetchRequestLog: state.candleFetchRequestLog.filter(
                (log) => log.id !== id,
            ),
        })),

    // Filter logs
    getLogById: (id: string) =>
        get().candleFetchRequestLog.find((log) => log.id === id),

    getLogsByStatus: (status: FetchStatus) =>
        get().candleFetchRequestLog.filter(
            (log) => log.request.status === status,
        ),

    getLogsByPool: (symbol: string, platform: string) =>
        get().candleFetchRequestLog.filter(
            (log) =>
                log.poolInfo.symbol === symbol &&
                log.poolInfo.platform === platform,
        ),

    getStats: () => {
        const logs = get().candleFetchRequestLog;
        return {
            total: logs.length,
            pending: logs.filter((l) => l.request.status === 'pending').length,
            resolved: logs.filter((l) => l.request.status === 'resolved')
                .length,
            rejected: logs.filter((l) => l.request.status === 'rejected')
                .length,
            bounced: logs.filter((l) => l.request.status === 'bounced').length,
            noData: logs.filter((l) => l.request.status === 'no-data').length,
        };
    },

    getCaller: (caller: string) => {
        const logs = get().candleFetchRequestLog;
        return logs.find((l) => l.request.caller === caller)?.id;
    },

    // Edit logs
    markResolved: (id, dataLength, firstCandleTime, lastCandleTime) => {
        const now = Date.now();

        set((state) => ({
            candleFetchRequestLog: state.candleFetchRequestLog.map((log) =>
                log.id === id
                    ? {
                          ...log,
                          request: {
                              ...log.request,
                              status: 'resolved',
                          },
                          response: {
                              time: now,
                              durationMs: now - log.request.time,
                              itemCount: dataLength,
                              firstCandleTime: firstCandleTime,
                              lastCandleTime: lastCandleTime,
                          },
                      }
                    : log,
            ),
        }));
    },

    markRejected: (id, error) =>
        set((state) => ({
            candleFetchRequestLog: state.candleFetchRequestLog.map((log) =>
                log.id === id
                    ? {
                          ...log,
                          request: {
                              ...log.request,
                              status: 'rejected',
                          },
                          error: {
                              message:
                                  error instanceof Error
                                      ? error.message
                                      : String(error),
                          },
                      }
                    : log,
            ),
        })),

    markBounced: (id, reason) =>
        set((state) => ({
            candleFetchRequestLog: state.candleFetchRequestLog.map((log) =>
                log.id === id
                    ? {
                          ...log,
                          request: {
                              ...log.request,
                              status: 'bounced',
                              reason: reason,
                          },
                      }
                    : log,
            ),
        })),

    markNoData: (id) => {
        const now = Date.now();

        set((state) => ({
            candleFetchRequestLog: state.candleFetchRequestLog.map((log) =>
                log.id === id
                    ? {
                          ...log,
                          request: {
                              ...log.request,
                              status: 'no-data',
                          },
                          response: {
                              time: now,
                              durationMs: now - log.request.time,
                              itemCount: 0,
                              firstCandleTime: 0,
                              lastCandleTime: 0,
                          },
                      }
                    : log,
            ),
        }));
    },
}));

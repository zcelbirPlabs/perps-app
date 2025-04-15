import {
    widget,
    type CandleStylePreferences,
    type IChartingLibraryWidget,
    type ResolutionString,
    type TradingTerminalFeatureset,
} from '~/tv/charting_library';
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef,
} from 'react';
import { createDataFeed } from '~/routes/chart/data/customDataFeed';
import { useWsObserver } from '~/hooks/useWsObserver';
import { useTradeDataStore } from '~/stores/TradeDataStore';
import {
    getChartLayout,
    saveChartLayout,
} from '~/routes/chart/data/utils/chartStorage';
import {
    priceFormatterFactory,
    type ChartLayout,
} from '~/routes/chart/data/utils/utils';
import {
    drawingEvent,
    drawingEventUnsubscribe,
    intervalChangedSubscribe,
    intervalChangedUnsubscribe,
    studyEvents,
    studyEventsUnsubscribe,
} from '~/routes/chart/data/utils/chartEvents';
import { useAppSettings, type colorSetIF } from '~/stores/AppSettingsStore';
import { useDebugStore } from '~/stores/DebugStore';
import { getMarkFillData } from '~/routes/chart/data/candleDataCache';
import type { UserFillIF } from '~/utils/orderbook/OrderBookIFs';
import { ApiEndpoints, useInfoApi } from '~/hooks/useInfoApi';
import { fillData } from '~/components/Trade/TwapTable/FillTwapTable/data';

interface TradingViewContextType {
    chart: IChartingLibraryWidget | null;
}

export const TradingViewContext = createContext<TradingViewContextType>({
    chart: null,
});

export interface ChartContainerProps {
    symbolName: string;
    libraryPath: string;
    chartsStorageUrl: string;
    chartsStorageApiVersion: string;
    clientId: string;
    userId: string;
    fullscreen: boolean;
    autosize: boolean;
    studiesOverrides: any;
    container: string;
}

export const TradingViewProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [chart, setChart] = useState<IChartingLibraryWidget | null>(null);

    const { subscribe } = useWsObserver();
    const { symbol, setUserFill, userFill } = useTradeDataStore();

    const [chartState, setChartState] = useState<ChartLayout | null>();
    const { fetchData } = useInfoApi();

    const { debugWallet } = useDebugStore();

    const createdAt = useRef<number>(Date.now());

    useEffect(() => {
        const res = getChartLayout();
        setChartState(res);
    }, []);

    const defaultProps: Omit<ChartContainerProps, 'container'> = {
        symbolName: 'BTC',
        libraryPath: '/tv/charting_library/',
        chartsStorageUrl: 'https://saveload.tradingview.com',
        chartsStorageApiVersion: '1.1',
        clientId: 'tradingview.com',
        userId: 'public_user_id',
        fullscreen: false,
        autosize: true,
        studiesOverrides: {},
    };

    // logic to change the active color pair
    const { bsColor, getBsColor } = useAppSettings();

    function changeColors(c: colorSetIF): void {
        // make sure the chart exists
        if (chart) {
            // object literal with all user-created candle customizations
            const mainSeriesProperties = JSON.parse(
                localStorage.getItem(
                    'tradingview.chartproperties.mainSeriesProperties',
                ) || '{}',
            );
            const candleStyle = mainSeriesProperties?.candleStyle || {};
            // array of color codes from candle properties we care about
            const activeColors: string[] | undefined = candleStyle
                ? [
                      candleStyle.upColor,
                      candleStyle.downColor,
                      candleStyle.borderUpColor,
                      candleStyle.borderDownColor,
                      candleStyle.wickUpColor,
                      candleStyle.wickDownColor,
                  ]
                : undefined;
            // determine if any of the candles have a color chosen through
            // ... the trading view color customization workflow (custom
            // ...  colors are always formatted as `rgba`)
            const isCustomized: boolean = activeColors
                ? activeColors.some((c: string) => c?.startsWith('rgba'))
                : false;
            // apply color scheme to chart ONLY if no custom colors are
            // ... found in the active colors array
            isCustomized ||
                chart.applyOverrides({
                    'mainSeriesProperties.candleStyle.upColor': c.buy,
                    'mainSeriesProperties.candleStyle.downColor': c.sell,
                    'mainSeriesProperties.candleStyle.borderUpColor': c.buy,
                    'mainSeriesProperties.candleStyle.borderDownColor': c.sell,
                    'mainSeriesProperties.candleStyle.wickUpColor': c.buy,
                    'mainSeriesProperties.candleStyle.wickDownColor': c.sell,
                });
        }
    }

    // side effect to load a custom color set into the table, runs when
    // ... the user changes the app's color theme and when the chart
    // ... finishes initialization
    useEffect(() => changeColors(getBsColor()), [bsColor, chart]);

    useEffect(() => {
        const tvWidget = new widget({
            container: 'tv_chart',
            library_path: defaultProps.libraryPath,
            timezone: 'Etc/UTC',
            symbol: symbol,
            fullscreen: false,
            autosize: true,
            datafeed: createDataFeed(subscribe, userFill, createdAt) as any,
            interval: (chartState?.interval || '1D') as ResolutionString,
            disabled_features: [
                'volume_force_overlay',
                'header_symbol_search',
                'header_compare',
                ...(chartState
                    ? [
                          'create_volume_indicator_by_default' as TradingTerminalFeatureset,
                      ]
                    : []),
            ],
            favorites: {
                intervals: ['5', '1h', 'D'] as ResolutionString[],
            },
            locale: 'en',
            theme: 'dark',
            overrides: {
                volumePaneSize: 'medium',
            },
            custom_css_url: './../tradingview-overrides.css',
            loading_screen: { backgroundColor: '#0e0e14' },
            saved_data: chartState ? chartState.chartLayout : undefined,
            // load_last_chart:false,
            time_frames: [
                { text: '5y', resolution: '1w' as ResolutionString },
                { text: '1y', resolution: '1w' as ResolutionString },
                { text: '6m', resolution: '120' as ResolutionString },
                { text: '3m', resolution: '60' as ResolutionString },
                { text: '1m', resolution: '30' as ResolutionString },
                { text: '5d', resolution: '5' as ResolutionString },
                { text: '1d', resolution: '1' as ResolutionString },
            ],
            custom_formatters: {
                priceFormatterFactory: priceFormatterFactory,
            },
        });

        tvWidget.onChartReady(() => {
            tvWidget.applyOverrides({
                'paneProperties.background': '#0e0e14',
                'paneProperties.backgroundType': 'solid',
            });

            /**
             * 0 -> main chart pane
             * 1 -> volume chart pane
             */
            const volumePaneIndex = 1;

            const paneCount = tvWidget.activeChart().getPanes().length;

            if (paneCount > volumePaneIndex) {
                const priceScale = tvWidget
                    .activeChart()
                    .getPanes()
                    [volumePaneIndex].getMainSourcePriceScale();

                if (priceScale) {
                    priceScale.setAutoScale(true);
                    priceScale.setMode(0);
                }
            }

            setChart(tvWidget);
        });

        return () => {
            if (chart) {
                drawingEventUnsubscribe(chart);
                studyEventsUnsubscribe(chart);
                intervalChangedUnsubscribe(chart);
                chart.remove();
            }
        };
    }, [chartState]);

    useEffect(() => {
        if (chart) {
            const chartRef = chart.chart();
            chartRef.setSymbol(symbol);
            saveChartLayout(chart);
        }
    }, [symbol]);

    useEffect(() => {
        if (!chart) return;
        drawingEvent(chart);
        studyEvents(chart);
        intervalChangedSubscribe(chart);
    }, [chart]);

    useEffect(() => {
        if (debugWallet.address) {
            getMarkFillData(symbol, debugWallet.address).then(() => {
                if (chart) {
                    chart.chart().clearMarks();
                    chart.chart().refreshMarks();
                }
            });
        }
    }, [debugWallet, chart, symbol]);

    useEffect(() => {
        if (debugWallet.address) {
            const isSameUserAndSymbol =
                userFill?.userWallet === debugWallet.address &&
                userFill?.symbol === symbol;

            if (isSameUserAndSymbol) return;

            fetchData({
                type: ApiEndpoints.Fill_ORDERS,
                payload: { user: debugWallet.address },
                handler: (data: UserFillIF[]) => {
                    setUserFill({
                        userWallet: debugWallet.address,
                        symbol: symbol,
                        fillData: data,
                    });

                    if (chart) {
                        chart.chart().clearMarks();
                        chart.chart().refreshMarks();
                    }
                },
            });
        }
    }, [debugWallet, chart, symbol]);

    useEffect(() => {
        if (chart) {
            chart.chart().clearMarks();
            chart.chart().refreshMarks();
        }
    }, [bsColor, chart]);

    return (
        <TradingViewContext.Provider value={{ chart }}>
            {children}
        </TradingViewContext.Provider>
    );
};

export const useTradingView = () => useContext(TradingViewContext);

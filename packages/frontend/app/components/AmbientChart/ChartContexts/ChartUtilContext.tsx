import React, { createContext, useContext, useState } from 'react';
import * as d3 from 'd3';
import { useMemo } from 'react';
import { useEffect } from 'react';

interface ChartUtilContextProps {
    reset: boolean;
    setReset: (value: boolean) => void;
    showLatest: boolean;
    setShowLatest: (value: boolean) => void;
    autoMode: boolean;
    setAutoMode: (value: boolean) => void;
    xScale: d3.ScaleLinear<number, number>;
    yScale: d3.ScaleLinear<number, number>;
}

const ChartUtilContext = createContext<ChartUtilContextProps | undefined>(
    undefined,
);

export const useChartUtilContext = () => {
    const context = useContext(ChartUtilContext);
    if (!context) {
        throw new Error(
            'useChartUtilContext must be used within a ChartUtilProvider',
        );
    }
    return context;
};

interface ChartUtilProviderProps {
    candleData: any;
    children: React.ReactNode;
}

export const ChartUtilProvider: React.FC<ChartUtilProviderProps> = ({
    candleData,
    children,
}) => {
    const [reset, setReset] = useState(false);
    const [showLatest, setShowLatest] = useState(true);
    const [autoMode, setAutoMode] = useState(true);

    const xDomain = [0, 0];
    const yDomain = [0, 0];
    const xRange = [0, 0];
    const yRange = [0, 0];

    const xScale = useMemo(
        () => d3.scaleLinear().domain(xDomain).range(xRange),
        [xDomain, xRange, candleData],
    );
    const yScale = useMemo(
        () => d3.scaleLinear().domain(yDomain).range(yRange),
        [yDomain, yRange, candleData],
    );

    return (
        <ChartUtilContext.Provider
            value={{
                reset,
                setReset,
                showLatest,
                setShowLatest,
                autoMode,
                setAutoMode,
                xScale,
                yScale,
            }}
        >
            {children}
        </ChartUtilContext.Provider>
    );
};

import React from 'react';

type ChartWidgetProps = {
    data: any;
    symbol: string;
    customize?: Record<string, any>;
    customCss?: string;
};

const ChartWidget: React.FC<ChartWidgetProps> = ({
    data,
    symbol,
    customize = {},
    customCss = '',
}) => {
    return (
        <div className='chart-widget-container'>
            <style>{customCss}</style>
            <div className='chart-header' style={customize.header}>
                <h2>{symbol} Chart</h2>
            </div>
            <div className='chart-content' style={customize.content}>
                {/* Render your chart here using the data prop */}
                <pre>{JSON.stringify(data, null, 2)}</pre>
            </div>
        </div>
    );
};

export default ChartWidget;

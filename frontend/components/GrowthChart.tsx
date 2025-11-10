
import React from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts';
import type { GrowthDataPoint } from '../types';

interface GrowthChartProps {
  data: GrowthDataPoint[];
}

const GrowthChart: React.FC<GrowthChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{
          top: 5, right: 30, left: 20, bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(205, 164, 52, 0.2)" />
        <XAxis 
            dataKey="month" 
            tick={{ fill: '#9ca3af', fontSize: 16 }} 
            axisLine={{ stroke: '#4b5563' }} 
            tickLine={{ stroke: '#4b5563' }}
        />
        <YAxis 
            yAxisId="left" 
            orientation="left" 
            stroke="#06b6d4" 
            tick={{ fill: '#06b6d4', fontSize: 16 }} 
            axisLine={{ stroke: '#06b6d4' }}
            label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft', fill: '#06b6d4' }}
        />
        <YAxis 
            yAxisId="right" 
            orientation="right" 
            stroke="#CDA434" 
            tick={{ fill: '#CDA434', fontSize: 16 }} 
            axisLine={{ stroke: '#CDA434' }}
            label={{ value: 'KDA Ratio', angle: 90, position: 'insideRight', fill: '#CDA434' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(1, 10, 19, 0.9)',
            borderColor: '#CDA434',
            fontSize: '18px',
            fontFamily: 'Teko, sans-serif'
          }}
          labelStyle={{ color: '#ffffff' }}
        />
        <Legend wrapperStyle={{fontSize: "20px"}}/>
        <Line yAxisId="left" type="monotone" dataKey="winRate" name="Win Rate" stroke="#06b6d4" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
        <Line yAxisId="right" type="monotone" dataKey="kda" name="KDA" stroke="#CDA434" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default GrowthChart;

// 全局变量
const API_BASE_URL = 'http://localhost:5000/api';

// 图表实例
let timeSeriesChart = null;
let transactionTypeChart = null;
let paymentMethodChart = null;
let counterpartyChart = null;

// 当前图表类型
let currentTimeChartType = 'line';
let currentCounterpartyChartType = 'count';

// 当前筛选条件
let currentFilters = {
    start_date: '',
    end_date: '',
    trans_type: '',
    trans_direction: '全部',
    freq: 'M'
};

// 分页数据
let currentPage = 1;
const pageSize = 20;
let allData = [];

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initCharts();
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    loadFilters();
    loadAllData();
});

// 更新当前时间
function updateCurrentTime() {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    document.getElementById('currentTime').textContent = now;
}

// 初始化图表
function initCharts() {
    timeSeriesChart = echarts.init(document.getElementById('timeSeriesChart'));
    transactionTypeChart = echarts.init(document.getElementById('transactionTypeChart'));
    paymentMethodChart = echarts.init(document.getElementById('paymentMethodChart'));
    counterpartyChart = echarts.init(document.getElementById('counterpartyChart'));

    // 窗口大小改变时重新调整图表
    window.addEventListener('resize', function() {
        timeSeriesChart.resize();
        transactionTypeChart.resize();
        paymentMethodChart.resize();
        counterpartyChart.resize();
    });
}

// 显示加载遮罩
function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

// 隐藏加载遮罩
function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

// 加载筛选选项
async function loadFilters() {
    try {
        const response = await fetch(`${API_BASE_URL}/filters`);
        const result = await response.json();
        
        if (result.success) {
            const filters = result.data;
            
            // 填充交易类型下拉框
            const transTypeSelect = document.getElementById('transType');
            filters['交易类型'].forEach(type => {
                if (type && type !== '/') {
                    const option = document.createElement('option');
                    option.value = type;
                    option.textContent = type;
                    transTypeSelect.appendChild(option);
                }
            });
            
            // 设置默认日期范围
            if (filters['年份范围'] && filters['年份范围']['最小'] && filters['年份范围']['最大']) {
                const startDate = document.getElementById('startDate');
                const endDate = document.getElementById('endDate');
                
                startDate.value = `${filters['年份范围']['最小']}-01-01`;
                endDate.value = `${filters['年份范围']['最大']}-12-31`;
            }
        }
    } catch (error) {
        console.error('加载筛选选项失败:', error);
    }
}

// 加载所有数据
async function loadAllData() {
    showLoading();
    
    try {
        // 并行加载所有需要的数据
        const [summaryResponse, timeSeriesResponse, transTypeResponse, payMethodResponse, counterpartyResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/summary`),
            fetch(`${API_BASE_URL}/time-series?freq=${currentFilters.freq}`),
            fetch(`${API_BASE_URL}/transaction-types`),
            fetch(`${API_BASE_URL}/payment-methods`),
            fetch(`${API_BASE_URL}/counterparties?top_n=20`)
        ]);
        
        const summaryResult = await summaryResponse.json();
        const timeSeriesResult = await timeSeriesResponse.json();
        const transTypeResult = await transTypeResponse.json();
        const payMethodResult = await payMethodResponse.json();
        const counterpartyResult = await counterpartyResponse.json();
        
        // 更新指标卡片
        if (summaryResult.success) {
            updateMetricsCards(summaryResult.data);
        }
        
        // 更新时间序列图表
        if (timeSeriesResult.success) {
            updateTimeSeriesChart(timeSeriesResult.data);
        }
        
        // 更新交易类型图表
        if (transTypeResult.success) {
            updateTransactionTypeChart(transTypeResult.data);
        }
        
        // 更新支付方式图表
        if (payMethodResult.success) {
            updatePaymentMethodChart(payMethodResult.data);
        }
        
        // 更新交易对方图表
        if (counterpartyResult.success) {
            updateCounterpartyChart(counterpartyResult.data);
        }
        
    } catch (error) {
        console.error('加载数据失败:', error);
        alert('加载数据失败，请检查后端服务是否启动');
    } finally {
        hideLoading();
    }
}

// 更新指标卡片
function updateMetricsCards(data) {
    // 总收入
    document.getElementById('totalIncome').textContent = formatCurrency(data['总收入']);
    document.getElementById('incomeCount').textContent = `${data['收入笔数']} 笔`;
    
    // 总支出
    document.getElementById('totalExpense').textContent = formatCurrency(data['总支出']);
    document.getElementById('expenseCount').textContent = `${data['支出笔数']} 笔`;
    
    // 净收入
    document.getElementById('netIncome').textContent = formatCurrency(data['净收入']);
    const netChange = data['净收入'] >= 0 ? '盈利' : '亏损';
    document.getElementById('netChange').textContent = netChange;
    
    // 总交易笔数
    document.getElementById('totalTransactions').textContent = data['总交易笔数'].toLocaleString();
    if (data['时间范围'] && data['时间范围']['开始'] && data['时间范围']['结束']) {
        document.getElementById('timeRange').textContent = `${data['时间范围']['开始']} ~ ${data['时间范围']['结束']}`;
    }
}

// 更新时间序列图表
function updateTimeSeriesChart(data) {
    if (!data || data.length === 0) {
        timeSeriesChart.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'center',
                textStyle: { color: '#a0aec0' }
            }
        });
        return;
    }
    
    const times = data.map(item => item['时间']);
    const incomes = data.map(item => item['收入']);
    const expenses = data.map(item => item['支出']);
    const netIncomes = data.map(item => item['净收入']);
    
    let option;
    
    if (currentTimeChartType === 'line') {
        option = {
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    let result = params[0].name + '<br/>';
                    params.forEach(param => {
                        result += `${param.marker} ${param.seriesName}: ${formatCurrency(param.value)}<br/>`;
                    });
                    return result;
                }
            },
            legend: {
                data: ['收入', '支出', '净收入'],
                textStyle: { color: '#a0aec0' },
                top: 0
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                top: '15%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: times,
                axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.3)' } },
                axisLabel: { color: '#a0aec0' }
            },
            yAxis: {
                type: 'value',
                axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.3)' } },
                axisLabel: { 
                    color: '#a0aec0',
                    formatter: function(value) {
                        return formatCurrencyShort(value);
                    }
                },
                splitLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.1)' } }
            },
            series: [
                {
                    name: '收入',
                    type: 'line',
                    smooth: true,
                    data: incomes,
                    lineStyle: { color: '#00ff88', width: 2 },
                    itemStyle: { color: '#00ff88' },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(0, 255, 136, 0.3)' },
                            { offset: 1, color: 'rgba(0, 255, 136, 0)' }
                        ])
                    }
                },
                {
                    name: '支出',
                    type: 'line',
                    smooth: true,
                    data: expenses,
                    lineStyle: { color: '#ff4757', width: 2 },
                    itemStyle: { color: '#ff4757' },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(255, 71, 87, 0.3)' },
                            { offset: 1, color: 'rgba(255, 71, 87, 0)' }
                        ])
                    }
                },
                {
                    name: '净收入',
                    type: 'line',
                    smooth: true,
                    data: netIncomes,
                    lineStyle: { color: '#ffa502', width: 2 },
                    itemStyle: { color: '#ffa502' }
                }
            ]
        };
    } else if (currentTimeChartType === 'bar') {
        option = {
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    let result = params[0].name + '<br/>';
                    params.forEach(param => {
                        result += `${param.marker} ${param.seriesName}: ${formatCurrency(param.value)}<br/>`;
                    });
                    return result;
                }
            },
            legend: {
                data: ['收入', '支出'],
                textStyle: { color: '#a0aec0' },
                top: 0
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                top: '15%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: times,
                axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.3)' } },
                axisLabel: { color: '#a0aec0' }
            },
            yAxis: {
                type: 'value',
                axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.3)' } },
                axisLabel: { 
                    color: '#a0aec0',
                    formatter: function(value) {
                        return formatCurrencyShort(value);
                    }
                },
                splitLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.1)' } }
            },
            series: [
                {
                    name: '收入',
                    type: 'bar',
                    data: incomes,
                    itemStyle: { 
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#00ff88' },
                            { offset: 1, color: '#00cc77' }
                        ])
                    }
                },
                {
                    name: '支出',
                    type: 'bar',
                    data: expenses,
                    itemStyle: { 
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#ff4757' },
                            { offset: 1, color: '#ff6b7a' }
                        ])
                    }
                }
            ]
        };
    } else if (currentTimeChartType === 'area') {
        option = {
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    let result = params[0].name + '<br/>';
                    params.forEach(param => {
                        result += `${param.marker} ${param.seriesName}: ${formatCurrency(param.value)}<br/>`;
                    });
                    return result;
                }
            },
            legend: {
                data: ['收入', '支出'],
                textStyle: { color: '#a0aec0' },
                top: 0
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                top: '15%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: times,
                axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.3)' } },
                axisLabel: { color: '#a0aec0' }
            },
            yAxis: {
                type: 'value',
                axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.3)' } },
                axisLabel: { 
                    color: '#a0aec0',
                    formatter: function(value) {
                        return formatCurrencyShort(value);
                    }
                },
                splitLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.1)' } }
            },
            series: [
                {
                    name: '收入',
                    type: 'line',
                    smooth: true,
                    stack: 'Total',
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(0, 255, 136, 0.5)' },
                            { offset: 1, color: 'rgba(0, 255, 136, 0.1)' }
                        ])
                    },
                    lineStyle: { color: '#00ff88' },
                    data: incomes
                },
                {
                    name: '支出',
                    type: 'line',
                    smooth: true,
                    stack: 'Total',
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(255, 71, 87, 0.5)' },
                            { offset: 1, color: 'rgba(255, 71, 87, 0.1)' }
                        ])
                    },
                    lineStyle: { color: '#ff4757' },
                    data: expenses
                }
            ]
        };
    }
    
    timeSeriesChart.setOption(option, true);
}

// 更新交易类型图表
function updateTransactionTypeChart(data) {
    if (!data || data.length === 0) {
        transactionTypeChart.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'center',
                textStyle: { color: '#a0aec0' }
            }
        });
        return;
    }
    
    // 取前 10 种交易类型
    const topData = data.slice(0, 10);
    
    const types = topData.map(item => item['交易类型']);
    const counts = topData.map(item => item['交易笔数']);
    
    const option = {
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} 笔 ({d}%)'
        },
        legend: {
            type: 'scroll',
            orient: 'vertical',
            right: '5%',
            top: 'center',
            textStyle: { color: '#a0aec0' }
        },
        series: [
            {
                type: 'pie',
                radius: ['30%', '60%'],
                center: ['35%', '50%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: '#0a0e27',
                    borderWidth: 2
                },
                label: {
                    show: false,
                    position: 'center'
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 16,
                        fontWeight: 'bold',
                        color: '#fff'
                    }
                },
                labelLine: {
                    show: false
                },
                data: topData.map((item, index) => ({
                    value: item['交易笔数'],
                    name: item['交易类型'],
                    itemStyle: {
                        color: getChartColor(index)
                    }
                }))
            }
        ]
    };
    
    transactionTypeChart.setOption(option, true);
}

// 更新支付方式图表
function updatePaymentMethodChart(data) {
    if (!data || data.length === 0) {
        paymentMethodChart.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'center',
                textStyle: { color: '#a0aec0' }
            }
        });
        return;
    }
    
    const methods = data.map(item => item['支付方式']);
    const counts = data.map(item => item['交易笔数']);
    
    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '3%',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.3)' } },
            axisLabel: { color: '#a0aec0' },
            splitLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.1)' } }
        },
        yAxis: {
            type: 'category',
            data: methods,
            axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.3)' } },
            axisLabel: { color: '#a0aec0' }
        },
        series: [
            {
                type: 'bar',
                data: data.map((item, index) => ({
                    value: item['交易笔数'],
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                            { offset: 0, color: getChartColor(index) },
                            { offset: 1, color: 'rgba(0, 212, 255, 0.3)' }
                        ])
                    }
                })),
                barWidth: '60%'
            }
        ]
    };
    
    paymentMethodChart.setOption(option, true);
}

// 更新交易对方图表
function updateCounterpartyChart(data) {
    if (!data || data.length === 0) {
        counterpartyChart.setOption({
            title: {
                text: '暂无数据',
                left: 'center',
                top: 'center',
                textStyle: { color: '#a0aec0' }
            }
        });
        return;
    }
    
    // 反转数据，让最大的显示在上面
    const reversedData = [...data].reverse();
    
    let values, label;
    if (currentCounterpartyChartType === 'count') {
        values = reversedData.map(item => item['交易笔数']);
        label = '交易笔数';
    } else {
        values = reversedData.map(item => Math.abs(item['总支出'] + item['总收入']));
        label = '交易金额';
    }
    
    const counterparties = reversedData.map(item => item['交易对方']);
    
    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            },
            formatter: function(params) {
                const dataItem = reversedData[params[0].dataIndex];
                if (currentCounterpartyChartType === 'count') {
                    return `${dataItem['交易对方']}<br/>
                            交易笔数: ${dataItem['交易笔数']} 笔<br/>
                            总收入: ${formatCurrency(dataItem['总收入'])}<br/>
                            总支出: ${formatCurrency(dataItem['总支出'])}`;
                } else {
                    return `${dataItem['交易对方']}<br/>
                            总收入: ${formatCurrency(dataItem['总收入'])}<br/>
                            总支出: ${formatCurrency(dataItem['总支出'])}<br/>
                            交易笔数: ${dataItem['交易笔数']} 笔`;
                }
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '3%',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.3)' } },
            axisLabel: { 
                color: '#a0aec0',
                formatter: function(value) {
                    if (currentCounterpartyChartType === 'amount') {
                        return formatCurrencyShort(value);
                    }
                    return value;
                }
            },
            splitLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.1)' } }
        },
        yAxis: {
            type: 'category',
            data: counterparties,
            axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.3)' } },
            axisLabel: { 
                color: '#a0aec0',
                fontSize: 11
            }
        },
        series: [
            {
                type: 'bar',
                data: values.map((value, index) => ({
                    value: value,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                            { offset: 0, color: getChartColor(index % 10) },
                            { offset: 1, color: 'rgba(0, 212, 255, 0.2)' }
                        ])
                    }
                })),
                barWidth: '70%'
            }
        ]
    };
    
    counterpartyChart.setOption(option, true);
}

// 切换时间图表类型
function switchTimeChartType(type) {
    currentTimeChartType = type;
    
    // 更新按钮状态
    const buttons = document.querySelectorAll('.chart-header:nth-child(1) .chart-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    if (type === 'line') {
        buttons[0].classList.add('active');
    } else if (type === 'bar') {
        buttons[1].classList.add('active');
    } else if (type === 'area') {
        buttons[2].classList.add('active');
    }
    
    // 重新加载数据并更新图表
    loadTimeSeriesData();
}

// 切换交易对方图表类型
function switchCounterpartyChartType(type) {
    currentCounterpartyChartType = type;
    
    // 更新按钮状态
    const buttons = document.querySelectorAll('.chart-header:nth-child(2) .chart-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    if (type === 'count') {
        buttons[0].classList.add('active');
    } else if (type === 'amount') {
        buttons[1].classList.add('active');
    }
    
    // 重新加载数据并更新图表
    loadCounterpartyData();
}

// 应用筛选条件
function applyFilters() {
    currentFilters.start_date = document.getElementById('startDate').value;
    currentFilters.end_date = document.getElementById('endDate').value;
    currentFilters.trans_type = document.getElementById('transType').value;
    currentFilters.trans_direction = document.getElementById('transDirection').value;
    currentFilters.freq = document.getElementById('timeFreq').value;
    
    loadAllData();
}

// 刷新数据
function refreshData() {
    loadAllData();
}

// 加载时间序列数据
async function loadTimeSeriesData() {
    try {
        const params = new URLSearchParams();
        params.append('freq', currentFilters.freq);
        if (currentFilters.start_date) params.append('start_date', currentFilters.start_date);
        if (currentFilters.end_date) params.append('end_date', currentFilters.end_date);
        if (currentFilters.trans_type) params.append('trans_type', currentFilters.trans_type);
        params.append('trans_direction', currentFilters.trans_direction);
        
        const response = await fetch(`${API_BASE_URL}/time-series?${params.toString()}`);
        const result = await response.json();
        
        if (result.success) {
            updateTimeSeriesChart(result.data);
        }
    } catch (error) {
        console.error('加载时间序列数据失败:', error);
    }
}

// 加载交易对方数据
async function loadCounterpartyData() {
    try {
        const params = new URLSearchParams();
        params.append('top_n', 20);
        if (currentFilters.start_date) params.append('start_date', currentFilters.start_date);
        if (currentFilters.end_date) params.append('end_date', currentFilters.end_date);
        if (currentFilters.trans_type) params.append('trans_type', currentFilters.trans_type);
        params.append('trans_direction', currentFilters.trans_direction);
        
        const response = await fetch(`${API_BASE_URL}/counterparties?${params.toString()}`);
        const result = await response.json();
        
        if (result.success) {
            updateCounterpartyChart(result.data);
        }
    } catch (error) {
        console.error('加载交易对方数据失败:', error);
    }
}

// 格式化货币
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return '¥0.00';
    }
    return '¥' + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 格式化简短货币（用于图表）
function formatCurrencyShort(value) {
    if (value >= 10000) {
        return '¥' + (value / 10000).toFixed(1) + '万';
    } else if (value >= 1000) {
        return '¥' + (value / 1000).toFixed(1) + '千';
    }
    return '¥' + value.toFixed(0);
}

// 获取图表颜色
function getChartColor(index) {
    const colors = [
        '#00d4ff',
        '#00ff88',
        '#ff4757',
        '#ffa502',
        '#a55eea',
        '#ff6b9d',
        '#2ed573',
        '#1e90ff',
        '#ff6348',
        '#3742fa'
    ];
    return colors[index % colors.length];
}

// 导出数据
function exportData() {
    alert('导出数据功能开发中...');
}

// 搜索功能
document.getElementById('searchInput').addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    console.log('搜索:', searchTerm);
    // TODO: 实现搜索过滤功能
});

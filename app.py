from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from data_loader import (
    get_cached_data,
    reload_data,
    get_summary_stats,
    get_time_series_data,
    get_transaction_type_data,
    get_counterparty_data,
    get_payment_method_data,
    get_transactions_list,
    filter_data
)

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 初始化时加载数据
print("正在初始化数据...")
df = get_cached_data()
print("数据初始化完成！")

@app.route('/api/summary', methods=['GET'])
def get_summary():
    """获取汇总统计数据"""
    global df
    
    # 获取过滤参数
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    trans_type = request.args.get('trans_type')
    trans_direction = request.args.get('trans_direction', '全部')
    
    # 过滤数据
    filtered_df = filter_data(df, start_date, end_date, trans_type, trans_direction)
    
    # 获取汇总数据
    summary = get_summary_stats(filtered_df)
    
    return jsonify({
        'success': True,
        'data': summary
    })

@app.route('/api/time-series', methods=['GET'])
def get_time_series():
    """获取时间序列数据"""
    global df
    
    # 获取参数
    freq = request.args.get('freq', 'M')  # 默认按月
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    trans_type = request.args.get('trans_type')
    trans_direction = request.args.get('trans_direction', '全部')
    
    # 过滤数据
    filtered_df = filter_data(df, start_date, end_date, trans_type, trans_direction)
    
    # 获取时间序列数据
    time_series = get_time_series_data(filtered_df, freq)
    
    return jsonify({
        'success': True,
        'data': time_series,
        'freq': freq
    })

@app.route('/api/transaction-types', methods=['GET'])
def get_transaction_types():
    """获取交易类型数据"""
    global df
    
    # 获取过滤参数
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    trans_direction = request.args.get('trans_direction', '全部')
    
    # 过滤数据
    filtered_df = filter_data(df, start_date, end_date, None, trans_direction)
    
    # 获取交易类型数据
    type_data = get_transaction_type_data(filtered_df)
    
    return jsonify({
        'success': True,
        'data': type_data
    })

@app.route('/api/counterparties', methods=['GET'])
def get_counterparties():
    """获取交易对方数据"""
    global df
    
    # 获取参数
    top_n = request.args.get('top_n', 20, type=int)
    sort_by = request.args.get('sort_by', 'count')  # 'count' 或 'amount'
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    trans_type = request.args.get('trans_type')
    trans_direction = request.args.get('trans_direction', '全部')
    
    # 过滤数据
    filtered_df = filter_data(df, start_date, end_date, trans_type, trans_direction)
    
    # 获取交易对方数据
    counterparty_data = get_counterparty_data(filtered_df, top_n, sort_by)
    
    return jsonify({
        'success': True,
        'data': counterparty_data
    })

@app.route('/api/payment-methods', methods=['GET'])
def get_payment_methods():
    """获取支付方式数据"""
    global df
    
    # 获取过滤参数
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    trans_type = request.args.get('trans_type')
    trans_direction = request.args.get('trans_direction', '全部')
    
    # 过滤数据
    filtered_df = filter_data(df, start_date, end_date, trans_type, trans_direction)
    
    # 获取支付方式数据
    pay_data = get_payment_method_data(filtered_df)
    
    return jsonify({
        'success': True,
        'data': pay_data
    })

@app.route('/api/filters', methods=['GET'])
def get_filters():
    """获取可用的筛选选项"""
    global df
    
    filters = {
        '交易类型': [],
        '支付方式': [],
        '年份范围': []
    }
    
    if not df.empty:
        # 获取所有交易类型（过滤掉空值和 '/'）
        if '交易类型' in df.columns:
            trans_types = df['交易类型'].dropna().unique().tolist()
            # 过滤掉空字符串和 '/'
            filters['交易类型'] = sorted([t for t in trans_types if t and t != '/' and str(t).strip()])
        
        # 获取所有支付方式（过滤掉空值和 '/'）
        if '支付方式' in df.columns:
            pay_methods = df['支付方式'].dropna().unique().tolist()
            # 过滤掉空字符串和 '/'
            filters['支付方式'] = sorted([p for p in pay_methods if p and p != '/' and str(p).strip()])
        
        # 获取年份范围
        if '交易时间' in df.columns:
            min_year = df['交易时间'].dt.year.min()
            max_year = df['交易时间'].dt.year.max()
            filters['年份范围'] = {
                '最小': int(min_year) if pd.notna(min_year) else None,
                '最大': int(max_year) if pd.notna(max_year) else None
            }
    
    return jsonify({
        'success': True,
        'data': filters
    })

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    """获取交易记录列表（用于表格展示）"""
    global df
    
    # 获取过滤参数
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    trans_type = request.args.get('trans_type')
    trans_direction = request.args.get('trans_direction', '全部')
    
    # 过滤数据
    filtered_df = filter_data(df, start_date, end_date, trans_type, trans_direction)
    
    # 获取交易记录列表
    transactions = get_transactions_list(filtered_df)
    
    return jsonify({
        'success': True,
        'data': transactions,
        'total': len(transactions)
    })

@app.route('/api/reload', methods=['POST'])
def reload():
    """重新加载数据"""
    global df
    df = reload_data()
    
    return jsonify({
        'success': True,
        'message': f'数据重新加载完成，共 {len(df)} 条记录'
    })

@app.route('/api/health', methods=['GET'])
def health():
    """健康检查接口"""
    return jsonify({
        'success': True,
        'message': '服务运行正常',
        'data_count': len(df) if not df.empty else 0
    })

@app.route('/', methods=['GET'])
def index():
    """主页，渲染大屏页面"""
    return render_template('index.html')

@app.route('/api', methods=['GET'])
def api_doc():
    """API 文档"""
    return jsonify({
        'name': '微信支付账单数据分析 API',
        'version': '1.0.0',
        'endpoints': {
            'GET /api/health': '健康检查',
            'GET /api/summary': '获取汇总统计数据',
            'GET /api/time-series': '获取时间序列数据',
            'GET /api/transaction-types': '获取交易类型数据',
            'GET /api/counterparties': '获取交易对方数据',
            'GET /api/payment-methods': '获取支付方式数据',
            'GET /api/filters': '获取可用的筛选选项',
            'POST /api/reload': '重新加载数据'
        },
        'parameters': {
            'start_date': '开始日期 (YYYY-MM-DD)',
            'end_date': '结束日期 (YYYY-MM-DD)',
            'trans_type': '交易类型',
            'trans_direction': '交易方向 (收入/支出/全部)',
            'freq': '时间频率 (D=日, W=周, M=月, Q=季度, Y=年)',
            'top_n': '返回前 N 条记录'
        }
    })

if __name__ == '__main__':
    print("启动 Flask 服务器...")
    print("API 文档: http://localhost:5000/")
    print("健康检查: http://localhost:5000/api/health")
    app.run(debug=True, host='0.0.0.0', port=5000)

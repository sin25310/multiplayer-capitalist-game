const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/stats', (req, res) => {
    try {
        const stats = getOnlineStats();
        const topCompanies = getLeaderboard().slice(0, 5).map(c => ({
            name: c.name,
            value: c.value,
            isPlayer: c.isPlayer,
            online: c.online
        }));
        
        res.json({
            players: stats,
            topCompanies: topCompanies,
            serverUptime: Date.now() - gameState.serverStartTime,
            activeContracts: gameState.marketContracts.filter(c => !c.fulfilled).length,
            alliances: gameState.alliances.length,
            globalEvent: gameState.globalEvent ? gameState.globalEvent.name : null
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// 扩展产品定义系统 - 多产业线
const PRODUCT_TIERS = {
    T1: { // 原材料
        steel: { name: '钢铁', basePrice: 100, category: 'metal', productionTime: 5 },
        oil: { name: '石油', basePrice: 80, category: 'energy', productionTime: 3 },
        silicon: { name: '硅', basePrice: 150, category: 'tech', productionTime: 8 },
        wood: { name: '木材', basePrice: 60, category: 'natural', productionTime: 2 },
        rare_earth: { name: '稀土', basePrice: 300, category: 'tech', productionTime: 15 },
        wheat: { name: '小麦', basePrice: 40, category: 'agriculture', productionTime: 10 },
        cotton: { name: '棉花', basePrice: 55, category: 'agriculture', productionTime: 12 },
        livestock: { name: '牲畜', basePrice: 120, category: 'agriculture', productionTime: 20 },
        sand: { name: '沙子', basePrice: 25, category: 'construction', productionTime: 1 },
        coal: { name: '煤炭', basePrice: 70, category: 'energy', productionTime: 4 }
    },
    T2: { // 初级产品
        plastic: { name: '塑料', basePrice: 200, category: 'material', recipe: { oil: 2 }, productionTime: 10 },
        chips: { name: '芯片', basePrice: 800, category: 'tech', recipe: { silicon: 1, rare_earth: 1 }, productionTime: 30 },
        steel_bar: { name: '钢材', basePrice: 250, category: 'material', recipe: { steel: 3 }, productionTime: 15 },
        fuel: { name: '燃料', basePrice: 180, category: 'energy', recipe: { oil: 2 }, productionTime: 8 },
        paper: { name: '纸张', basePrice: 120, category: 'material', recipe: { wood: 2 }, productionTime: 5 },
        flour: { name: '面粉', basePrice: 80, category: 'food', recipe: { wheat: 3 }, productionTime: 8 },
        fabric: { name: '布料', basePrice: 140, category: 'textile', recipe: { cotton: 2 }, productionTime: 12 },
        meat: { name: '肉类', basePrice: 280, category: 'food', recipe: { livestock: 1 }, productionTime: 15 },
        glass: { name: '玻璃', basePrice: 160, category: 'construction', recipe: { sand: 4, coal: 1 }, productionTime: 18 },
        cement: { name: '水泥', basePrice: 90, category: 'construction', recipe: { sand: 2, coal: 2 }, productionTime: 12 }
    },
    T3: { // 中级产品
        components: { name: '电子组件', basePrice: 1500, category: 'tech', recipe: { chips: 2, plastic: 1 }, productionTime: 60 },
        machinery: { name: '机械零件', basePrice: 1200, category: 'industrial', recipe: { steel_bar: 3, plastic: 1 }, productionTime: 45 },
        software: { name: '软件', basePrice: 2000, category: 'tech', recipe: { chips: 1 }, productionTime: 90 },
        textiles: { name: '纺织品', basePrice: 800, category: 'consumer', recipe: { fabric: 2, plastic: 1 }, productionTime: 30 },
        processed_food: { name: '加工食品', basePrice: 350, category: 'food', recipe: { flour: 2, meat: 1 }, productionTime: 25 },
        cosmetics: { name: '化妆品', basePrice: 600, category: 'beauty', recipe: { plastic: 1, paper: 1 }, productionTime: 35 },
        windows: { name: '门窗', basePrice: 450, category: 'construction', recipe: { glass: 2, steel_bar: 1 }, productionTime: 40 },
        furniture: { name: '家具', basePrice: 700, category: 'home', recipe: { wood: 4, fabric: 1 }, productionTime: 50 }
    },
    T4: { // 高级产品
        smartphone: { name: '智能手机', basePrice: 8000, category: 'consumer', recipe: { components: 3, software: 1 }, productionTime: 180 },
        car: { name: '汽车', basePrice: 25000, category: 'consumer', recipe: { machinery: 8, components: 2, fuel: 5 }, productionTime: 300 },
        computer: { name: '计算机', basePrice: 12000, category: 'tech', recipe: { components: 5, software: 2 }, productionTime: 240 },
        clothing: { name: '服装', basePrice: 500, category: 'consumer', recipe: { textiles: 2 }, productionTime: 45 },
        restaurant_meal: { name: '精品餐饮', basePrice: 120, category: 'food', recipe: { processed_food: 2 }, productionTime: 20 },
        luxury_cosmetics: { name: '高端化妆品', basePrice: 2500, category: 'beauty', recipe: { cosmetics: 3, rare_earth: 1 }, productionTime: 120 },
        house: { name: '房屋', basePrice: 80000, category: 'real_estate', recipe: { cement: 50, windows: 10, furniture: 5 }, productionTime: 600 },
        appliances: { name: '家电', basePrice: 3500, category: 'home', recipe: { components: 4, steel_bar: 2 }, productionTime: 150 }
    },
    T5: { // 奢侈品
        luxury_car: { name: '豪华汽车', basePrice: 100000, category: 'luxury', recipe: { car: 1, components: 5 }, productionTime: 600 },
        premium_phone: { name: '限量手机', basePrice: 20000, category: 'luxury', recipe: { smartphone: 1, rare_earth: 2 }, productionTime: 360 },
        designer_clothes: { name: '设计师服装', basePrice: 5000, category: 'luxury', recipe: { clothing: 3, rare_earth: 1 }, productionTime: 180 },
        michelin_dining: { name: '米其林餐厅', basePrice: 2000, category: 'luxury', recipe: { restaurant_meal: 5, luxury_cosmetics: 1 }, productionTime: 300 },
        premium_beauty: { name: '顶级美容', basePrice: 8000, category: 'luxury', recipe: { luxury_cosmetics: 4, rare_earth: 2 }, productionTime: 400 },
        mansion: { name: '豪宅', basePrice: 500000, category: 'luxury', recipe: { house: 1, luxury_car: 1, appliances: 10 }, productionTime: 1200 },
        private_jet: { name: '私人飞机', basePrice: 2000000, category: 'luxury', recipe: { machinery: 100, components: 50, fuel: 200 }, productionTime: 2400 }
    }
};

// 合并同类工厂类型 - 删除等级限制
const FACTORY_TYPES = {
    extraction: {
        name: '采矿农场',
        emoji: '⛏️',
        cost: { money: 100000 },
        produces: ['steel', 'oil', 'silicon', 'wood', 'rare_earth', 'wheat', 'cotton', 'livestock', 'sand', 'coal'],
        description: '开采原材料和农业生产',
        category: 'primary',
        efficiency: 1.0
    },
    processing: {
        name: '加工厂',
        emoji: '🏭',
        cost: { money: 300000, steel: 50 },
        produces: ['plastic', 'chips', 'steel_bar', 'fuel', 'paper', 'flour', 'fabric', 'meat', 'glass', 'cement'],
        description: '初级产品加工生产',
        category: 'secondary',
        efficiency: 1.0
    },
    manufacturing: {
        name: '制造厂',
        emoji: '🔧',
        cost: { money: 800000, steel_bar: 100 },
        produces: ['components', 'machinery', 'software', 'textiles', 'processed_food', 'cosmetics', 'windows', 'furniture'],
        description: '中级产品制造',
        category: 'tertiary',
        efficiency: 1.0
    },
    assembly: {
        name: '组装厂',
        emoji: '🔩',
        cost: { money: 1500000, machinery: 50, components: 20 },
        produces: ['smartphone', 'car', 'computer', 'clothing', 'restaurant_meal', 'luxury_cosmetics', 'house', 'appliances'],
        description: '高级产品组装',
        category: 'quaternary',
        efficiency: 1.0
    },
    luxury: {
        name: '奢侈品工坊',
        emoji: '💎',
        cost: { money: 5000000, components: 100, rare_earth: 50 },
        produces: ['luxury_car', 'premium_phone', 'designer_clothes', 'michelin_dining', 'premium_beauty', 'mansion', 'private_jet'],
        description: '奢侈品制造',
        category: 'luxury',
        efficiency: 1.0
    }
};

// 市场层级定义 - 删除等级限制
const MARKET_TIERS = {
    local: {
        name: '本地市场',
        emoji: '🏪',
        allowedTiers: ['T1', 'T2'],
        priceMultiplier: 0.8,
        demandMultiplier: 2.0,
        description: '起步市场，价格较低但需求稳定'
    },
    domestic: {
        name: '国内市场',
        emoji: '🇨🇳',
        allowedTiers: ['T1', 'T2', 'T3'],
        priceMultiplier: 1.0,
        demandMultiplier: 1.5,
        description: '国内大市场，价格合理'
    },
    international: {
        name: '国际市场',
        emoji: '🌍',
        allowedTiers: ['T2', 'T3', 'T4'],
        priceMultiplier: 1.3,
        demandMultiplier: 1.0,
        description: '国际市场，高价但竞争激烈'
    },
    luxury: {
        name: '奢侈品市场',
        emoji: '💎',
        allowedTiers: ['T4', 'T5'],
        priceMultiplier: 2.0,
        demandMultiplier: 0.3,
        description: '高端市场，暴利但需求极少'
    }
};

// 科技树定义 - 删除等级限制
const TECH_TREE = {
    efficiency_1: {
        name: '生产效率优化',
        cost: { money: 300000, chips: 5 },
        effect: '所有工厂生产效率+25%',
        description: '优化生产流程，提升整体效率',
        category: 'efficiency'
    },
    quality_control: {
        name: '质量控制系统',
        cost: { money: 400000, components: 20 },
        effect: '产品价值+30%',
        description: '建立完善的质量管控体系',
        category: 'quality'
    },
    supply_chain: {
        name: '供应链优化',
        cost: { money: 600000, software: 3 },
        effect: '原料消耗-20%',
        description: '优化供应链管理，降低原料浪费',
        category: 'logistics'
    },
    market_research: {
        name: '市场研究',
        cost: { money: 500000, processed_food: 100 },
        effect: '市场交易手续费-50%',
        description: '深入了解市场规律，降低交易成本',
        category: 'market'
    },
    advanced_manufacturing: {
        name: '先进制造技术',
        cost: { money: 1500000, machinery: 50 },
        requires: ['efficiency_1', 'quality_control'],
        effect: '解锁高级工厂，生产效率+50%',
        description: '掌握最新制造技术',
        category: 'manufacturing'
    },
    ai_analytics: {
        name: 'AI数据分析',
        cost: { money: 2500000, computer: 10 },
        requires: ['market_research', 'supply_chain'],
        effect: '预测市场趋势，获得额外收益+30%',
        description: 'AI驱动的市场分析系统',
        category: 'ai'
    },
    global_expansion: {
        name: '全球化扩张',
        cost: { money: 5000000, luxury_car: 5 },
        requires: ['advanced_manufacturing', 'ai_analytics'],
        effect: '解锁全球市场，所有收益+100%',
        description: '建立全球化商业网络',
        category: 'expansion'
    },
    sustainability: {
        name: '可持续发展',
        cost: { money: 3000000, house: 10 },
        requires: ['supply_chain'],
        effect: '环保生产，政府补贴+50%',
        description: '绿色制造技术',
        category: 'environment'
    }
};

// 10个AI公司（neta现实公司名）
const gameState = {
    companies: new Map(),
    playerNames: new Map(),
    aiCompanies: [
        {
            id: 'ai_fruit_tech',
            name: '水果科技',
            value: 180000000,
            trend: 1,
            sector: '科技',
            companyType: 'tech',
            volatility: 0.12,
            underAttack: false,
            specialty: 'electronics',
            stockHistory: [],
            sharePrice: 180, // 每股价格
            totalShares: 1000000, // 总股数
            tradingVolume: 0 // 交易量
        },
        {
            id: 'ai_micro_soft',
            name: '微硬公司',
            value: 165000000,
            trend: 0,
            sector: '软件',
            companyType: 'tech',
            volatility: 0.08,
            underAttack: false,
            specialty: 'software',
            stockHistory: [],
            sharePrice: 165,
            totalShares: 1000000,
            tradingVolume: 0
        },
        {
            id: 'ai_google_search',
            name: '谷歌搜索',
            value: 170000000,
            trend: -1,
            sector: '互联网',
            companyType: 'tech',
            volatility: 0.10,
            underAttack: false,
            specialty: 'data_services',
            stockHistory: [],
            sharePrice: 170,
            totalShares: 1000000,
            tradingVolume: 0
        },
        {
            id: 'ai_tesla_auto',
            name: '特斯拉汽车',
            value: 95000000,
            trend: 1,
            sector: '汽车',
            companyType: 'manufacturing',
            volatility: 0.18,
            underAttack: false,
            specialty: 'automotive',
            stockHistory: [],
            sharePrice: 95,
            totalShares: 1000000,
            tradingVolume: 0
        },
        {
            id: 'ai_amazon_retail',
            name: '亚马逊零售',
            value: 140000000,
            trend: 0,
            sector: '电商',
            companyType: 'retail',
            volatility: 0.09,
            underAttack: false,
            specialty: 'logistics',
            stockHistory: [],
            sharePrice: 140,
            totalShares: 1000000,
            tradingVolume: 0
        },
        {
            id: 'ai_meta_social',
            name: '元宇宙社交',
            value: 85000000,
            trend: -1,
            sector: '社交媒体',
            companyType: 'tech',
            volatility: 0.15,
            underAttack: false,
            specialty: 'social_media',
            stockHistory: [],
            sharePrice: 85,
            totalShares: 1000000,
            tradingVolume: 0
        },
        {
            id: 'ai_nike_sports',
            name: '耐克体育',
            value: 75000000,
            trend: 1,
            sector: '服装',
            companyType: 'retail',
            volatility: 0.11,
            underAttack: false,
            specialty: 'sportswear',
            stockHistory: [],
            sharePrice: 75,
            totalShares: 1000000,
            tradingVolume: 0
        },
        {
            id: 'ai_coca_cola',
            name: '可口可乐',
            value: 68000000,
            trend: 0,
            sector: '饮料',
            companyType: 'food',
            volatility: 0.06,
            underAttack: false,
            specialty: 'beverages',
            stockHistory: [],
            sharePrice: 68,
            totalShares: 1000000,
            tradingVolume: 0
        },
        {
            id: 'ai_loreal_beauty',
            name: '欧莱雅美妆',
            value: 55000000,
            trend: 1,
            sector: '美妆',
            companyType: 'beauty',
            volatility: 0.13,
            underAttack: false,
            specialty: 'cosmetics',
            stockHistory: [],
            sharePrice: 55,
            totalShares: 1000000,
            tradingVolume: 0
        },
        {
            id: 'ai_mcdonalds',
            name: '麦当劳餐饮',
            value: 45000000,
            trend: 0,
            sector: '快餐',
            companyType: 'food',
            volatility: 0.07,
            underAttack: false,
            specialty: 'fast_food',
            stockHistory: [],
            sharePrice: 45,
            totalShares: 1000000,
            tradingVolume: 0
        }
    ],
    globalMarkets: {
        local: initializeMarket('local'),
        domestic: initializeMarket('domestic'),
        international: initializeMarket('international'),
        luxury: initializeMarket('luxury')
    },
    marketContracts: [],
    alliances: [],
    globalEvent: null,
    chatMessages: [],
    newsEvents: [],
    serverStartTime: Date.now(),
    lastEventTime: Date.now(),
    eventDuration: 10 * 60 * 1000, // 10分钟事件周期
    gameVersion: '2.2.0' // 更新版本号
};

function initializeMarket(marketType) {
    const market = {};
    const marketInfo = MARKET_TIERS[marketType];
    
    Object.keys(PRODUCT_TIERS).forEach(tier => {
        if (marketInfo.allowedTiers.includes(tier)) {
            Object.keys(PRODUCT_TIERS[tier]).forEach(productId => {
                const product = PRODUCT_TIERS[tier][productId];
                market[productId] = {
                    price: Math.floor(product.basePrice * marketInfo.priceMultiplier),
                    demand: Math.floor(100 * marketInfo.demandMultiplier),
                    supply: 100,
                    trend: 0,
                    volume: 0,
                    priceHistory: []
                };
            });
        }
    });
    
    return market;
}

// 生产任务类 - 全自动化
class ProductionTask {
    constructor(factoryId, productId, quantity, companyId) {
        this.id = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.factoryId = factoryId;
        this.productId = productId;
        this.quantity = quantity;
        this.companyId = companyId;
        this.startTime = Date.now();
        this.completed = false;
        
        const product = this.getProductInfo();
        this.completionTime = this.startTime + (product.productionTime * 1000 * quantity);
        this.progress = 0;
    }
    
    getProductInfo() {
        for (const tier of Object.values(PRODUCT_TIERS)) {
            if (tier[this.productId]) {
                return tier[this.productId];
            }
        }
        return null;
    }
    
    isReady() {
        return Date.now() >= this.completionTime;
    }
    
    getProgress() {
        const elapsed = Date.now() - this.startTime;
        const total = this.completionTime - this.startTime;
        return Math.min(elapsed / total, 1);
    }
    
    getRemainingTime() {
        return Math.max(0, this.completionTime - Date.now());
    }
}

// 联盟系统
class Alliance {
    constructor(id, name, creator) {
        this.id = id;
        this.name = name;
        this.creator = creator;
        this.members = [creator];
        this.createdAt = Date.now();
        this.totalValue = 0;
        this.contracts = [];
    }

    addMember(companyName) {
        if (!this.members.includes(companyName)) {
            this.members.push(companyName);
            return true;
        }
        return false;
    }

    removeMember(companyName) {
        const index = this.members.indexOf(companyName);
        if (index > -1) {
            this.members.splice(index, 1);
            return true;
        }
        return false;
    }

    updateTotalValue(companies) {
        this.totalValue = this.members.reduce((total, memberName) => {
            const company = Array.from(companies.values()).find(c => c.name === memberName);
            return total + (company ? calculateCompanyValue(company.gameData) : 0);
        }, 0);
    }
}

// 10分钟事件系统
const TIMED_EVENTS = [
    {
        id: 'supply_shortage',
        name: '原料短缺',
        description: '全球供应链紧张，原材料价格上涨50%',
        duration: 600000,
        effects: {
            marketPriceMultiplier: { T1: 1.5 }
        }
    },
    {
        id: 'tech_breakthrough',
        name: '技术突破',
        description: '新技术降低了电子产品制造成本',
        duration: 600000,
        effects: {
            productionCostMultiplier: { electronics: 0.7 }
        }
    },
    {
        id: 'luxury_boom',
        name: '奢侈品热潮',
        description: '富人消费激增，奢侈品需求暴涨',
        duration: 600000,
        effects: {
            marketDemandMultiplier: { T5: 3.0 },
            marketPriceMultiplier: { T5: 1.3 }
        }
    },
    {
        id: 'agricultural_boom',
        name: '农业丰收',
        description: '农产品大丰收，农业产品价格下跌，需求增加',
        duration: 600000,
        effects: {
            marketPriceMultiplier: { agriculture: 0.7 },
            marketDemandMultiplier: { agriculture: 2.0 }
        }
    },
    {
        id: 'housing_crisis',
        name: '房地产热潮',
        description: '房地产市场火爆，建材需求暴增',
        duration: 600000,
        effects: {
            marketPriceMultiplier: { construction: 1.8 },
            marketDemandMultiplier: { real_estate: 2.5 }
        }
    },
    {
        id: 'beauty_trend',
        name: '美妆潮流',
        description: '新的美妆潮流兴起，化妆品需求激增',
        duration: 600000,
        effects: {
            marketPriceMultiplier: { beauty: 1.4 },
            marketDemandMultiplier: { beauty: 2.2 }
        }
    }
];

console.log('🏢 黑心公司大亨 v2.2 服务器启动中...');

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 玩家连接处理
io.on('connection', (socket) => {
    console.log('🔗 新CEO连接:', socket.id);
    
    socket.on('joinGame', (data) => {
        try {
            const { companyName, playerName, companyType, gameData } = data;
            
            if (!companyName || !playerName) {
                socket.emit('error', { message: '公司名称和玩家名称不能为空' });
                return;
            }
            
            // 检查同名公司
            const existingPlayerWithSameName = Array.from(gameState.companies.values())
                .find(company => company.name === companyName && company.online);
            
            if (existingPlayerWithSameName) {
                socket.emit('nameConflict', { 
                    message: `公司名称 "${companyName}" 已被在线玩家使用，请选择其他名称`,
                    suggestion: companyName + '_' + Math.floor(Math.random() * 1000)
                });
                return;
            }
            
            // 检查版本，如果是旧版本数据则重置
            let inheritedData = null;
            let oldPlayerId = null;
            
            const offlinePlayerWithSameName = Array.from(gameState.companies.values())
                .find(company => company.name === companyName && !company.online);
            
            if (offlinePlayerWithSameName && offlinePlayerWithSameName.gameData.version === gameState.gameVersion) {
                console.log(`🔄 发现同名离线玩家，准备继承存档: ${companyName}`);
                inheritedData = offlinePlayerWithSameName.gameData;
                oldPlayerId = offlinePlayerWithSameName.id;
                
                gameState.companies.delete(oldPlayerId);
                if (gameState.playerNames.has(companyName)) {
                    gameState.playerNames.delete(companyName);
                }
                
                socket.emit('inheritanceSuccess', {
                    message: `成功继承 "${companyName}" 的存档数据`,
                    inheritedValue: calculateCompanyValue(inheritedData),
                    lastSeen: offlinePlayerWithSameName.lastSeen
                });
            } else if (offlinePlayerWithSameName) {
                // 版本不匹配，清理旧数据
                gameState.companies.delete(offlinePlayerWithSameName.id);
                gameState.playerNames.delete(companyName);
                socket.emit('versionReset', {
                    message: '游戏已更新到v2.2，新增金融市场交易系统！所有进度已重置。'
                });
            }
            
            const companyData = {
                id: socket.id,
                name: companyName,
                playerName: playerName,
                companyType: companyType || 'tech',
                gameData: inheritedData || createNewCompany(companyType),
                online: true,
                lastSeen: Date.now(),
                socket: socket,
                inheritedFrom: oldPlayerId,
                stockHistory: []
            };
            
            gameState.companies.set(socket.id, companyData);
            gameState.playerNames.set(companyName, socket.id);
            
            socket.emit('gameState', {
                globalMarkets: gameState.globalMarkets,
                marketContracts: gameState.marketContracts,
                leaderboard: getLeaderboard(),
                chatMessages: gameState.chatMessages.slice(-50),
                globalEvent: gameState.globalEvent,
                alliances: gameState.alliances.map(alliance => ({
                    id: alliance.id,
                    name: alliance.name,
                    creator: alliance.creator,
                    members: alliance.members,
                    totalValue: alliance.totalValue
                })),
                productTiers: PRODUCT_TIERS,
                factoryTypes: FACTORY_TYPES,
                marketTiers: MARKET_TIERS,
                techTree: TECH_TREE,
                aiCompanies: gameState.aiCompanies
            });
            
            socket.broadcast.emit('companyJoined', {
                id: socket.id,
                name: companyName
            });
            
            if (inheritedData) {
                addChatMessage('系统', `${companyName} 重新回到了商业世界！`);
                addNewsEvent(`🔄 ${companyName} 王者归来，继承商业帝国重新参战`);
            } else {
                addChatMessage('系统', `${companyName} 进入了全新的多产业制造世界！`);
                addNewsEvent(`🏢 ${companyName} 开始了多产业线制造之旅`);
            }
            
            console.log(`🏢 公司 ${companyName}(${companyType}) ${inheritedData ? '继承存档' : '新建'}加入游戏`);
        } catch (error) {
            console.error('joinGame error:', error);
            socket.emit('error', { message: '加入游戏失败' });
        }
    });
    
    socket.on('updateGameData', (gameData) => {
        try {
            const company = gameState.companies.get(socket.id);
            if (company && gameData) {
                company.gameData = gameData;
                company.lastSeen = Date.now();
            }
        } catch (error) {
            console.error('updateGameData error:', error);
        }
    });
    
    // 建造工厂
    socket.on('buildFactory', (data) => {
        try {
            const { factoryType } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company || !FACTORY_TYPES[factoryType]) {
                return;
            }
            
            const factory = FACTORY_TYPES[factoryType];
            
            if (!canAfford(company.gameData.inventory, factory.cost)) {
                socket.emit('error', { message: '资源不足，无法建造工厂' });
                return;
            }
            
            payCost(company.gameData.inventory, factory.cost);
            
            // 合并同类工厂
            if (!company.gameData.factories[factoryType]) {
                company.gameData.factories[factoryType] = {
                    type: factoryType,
                    count: 0,
                    level: 1,
                    efficiency: factory.efficiency,
                    productionTasks: [],
                    totalProduced: 0
                };
            }
            
            company.gameData.factories[factoryType].count++;
            
            socket.emit('factoryBuilt', {
                factoryType: factoryType,
                message: `成功建造 ${factory.name}！现在拥有 ${company.gameData.factories[factoryType].count} 个`,
                playerData: {
                    inventory: company.gameData.inventory,
                    factories: company.gameData.factories
                }
            });
            
            addChatMessage('工业快讯', `${company.name} 建造了 ${factory.name}，总数达到 ${company.gameData.factories[factoryType].count} 个`);
            
        } catch (error) {
            console.error('buildFactory error:', error);
        }
    });
    
    // 开始生产 - 全自动化
    socket.on('startProduction', (data) => {
        try {
            const { factoryType, productId, quantity } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company || !company.gameData.factories[factoryType]) {
                return;
            }
            
            const factory = company.gameData.factories[factoryType];
            const factoryTypeData = FACTORY_TYPES[factory.type];
            
            if (!factoryTypeData.produces.includes(productId)) {
                socket.emit('error', { message: '此工厂无法生产该产品' });
                return;
            }
            
            if (factory.count === 0) {
                socket.emit('error', { message: '没有可用的工厂' });
                return;
            }
            
            // 检查原料
            const product = getProductByKey(productId);
            if (!product) {
                socket.emit('error', { message: '未知产品' });
                return;
            }
            
            if (product.recipe) {
                const totalRecipe = {};
                Object.keys(product.recipe).forEach(material => {
                    totalRecipe[material] = product.recipe[material] * quantity;
                });
                
                if (!canAfford(company.gameData.inventory, totalRecipe)) {
                    socket.emit('error', { message: '原料不足' });
                    return;
                }
                
                payCost(company.gameData.inventory, totalRecipe);
            }
            
            const task = new ProductionTask(factoryType, productId, quantity, socket.id);
            
            // 添加到生产任务列表
            if (!factory.productionTasks) factory.productionTasks = [];
            factory.productionTasks.push(task);
            
            socket.emit('productionStarted', {
                task: {
                    id: task.id,
                    productId: task.productId,
                    quantity: task.quantity,
                    completionTime: task.completionTime,
                    progress: task.getProgress(),
                    remainingTime: task.getRemainingTime()
                },
                playerData: {
                    inventory: company.gameData.inventory,
                    factories: company.gameData.factories
                }
            });
            
        } catch (error) {
            console.error('startProduction error:', error);
        }
    });
    
    // 金融市场交易 - 新增
    socket.on('stockTrade', (data) => {
        try {
            const { action, companyId, shares, multiplier } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company) return;
            
            // 找到目标公司（AI公司或玩家公司）
            let targetCompany = gameState.aiCompanies.find(ai => ai.id === companyId);
            if (!targetCompany) {
                const playerCompany = Array.from(gameState.companies.values()).find(c => c.id === companyId);
                if (playerCompany) {
                    targetCompany = {
                        id: playerCompany.id,
                        name: playerCompany.name,
                        sharePrice: Math.floor(calculateCompanyValue(playerCompany.gameData) / 1000000),
                        totalShares: 1000000,
                        tradingVolume: 0
                    };
                }
            }
            
            if (!targetCompany) return;
            
            const tradeShares = shares * (multiplier || 1);
            const totalCost = targetCompany.sharePrice * tradeShares;
            const tradeFee = totalCost * 0.01; // 1%手续费
            
            if (!company.gameData.stockPortfolio) {
                company.gameData.stockPortfolio = {};
            }
            
            if (action === 'buy') {
                if (company.gameData.inventory.money >= totalCost + tradeFee) {
                    company.gameData.inventory.money -= totalCost + tradeFee;
                    company.gameData.stockPortfolio[companyId] = (company.gameData.stockPortfolio[companyId] || 0) + tradeShares;
                    
                    // 更新目标公司股价（买入推高股价）
                    const priceImpact = Math.min(0.05, tradeShares / targetCompany.totalShares * 10);
                    targetCompany.sharePrice = Math.floor(targetCompany.sharePrice * (1 + priceImpact));
                    targetCompany.tradingVolume += tradeShares;
                    
                    socket.emit('stockTradeSuccess', {
                        action, companyId, shares: tradeShares,
                        message: `买入 ${targetCompany.name} ${tradeShares} 股，花费 ${formatNumber(totalCost)} 💰`,
                        playerData: {
                            money: company.gameData.inventory.money,
                            stockPortfolio: company.gameData.stockPortfolio
                        }
                    });
                    
                    // 检查持股节点事件
                    checkShareholdingEvent(company, targetCompany, tradeShares, 'buy');
                    
                    addChatMessage('金融快讯', `${company.name} 买入 ${targetCompany.name} ${formatNumber(tradeShares)} 股`);
                }
            }
            else if (action === 'sell') {
                const ownedShares = company.gameData.stockPortfolio[companyId] || 0;
                if (ownedShares >= tradeShares) {
                    const sellValue = targetCompany.sharePrice * tradeShares - tradeFee;
                    company.gameData.inventory.money += sellValue;
                    company.gameData.stockPortfolio[companyId] -= tradeShares;
                    
                    if (company.gameData.stockPortfolio[companyId] <= 0) {
                        delete company.gameData.stockPortfolio[companyId];
                    }
                    
                    // 更新目标公司股价（卖出压低股价）
                    const priceImpact = Math.min(0.05, tradeShares / targetCompany.totalShares * 10);
                    targetCompany.sharePrice = Math.floor(targetCompany.sharePrice * (1 - priceImpact));
                    targetCompany.tradingVolume += tradeShares;
                    
                    socket.emit('stockTradeSuccess', {
                        action, companyId, shares: tradeShares,
                        message: `卖出 ${targetCompany.name} ${tradeShares} 股，获得 ${formatNumber(sellValue)} 💰`,
                        playerData: {
                            money: company.gameData.inventory.money,
                            stockPortfolio: company.gameData.stockPortfolio
                        }
                    });
                    
                    // 检查抛售节点事件
                    checkShareholdingEvent(company, targetCompany, tradeShares, 'sell');
                    
                    addChatMessage('金融快讯', `${company.name} 卖出 ${targetCompany.name} ${formatNumber(tradeShares)} 股`);
                }
            }
            else if (action === 'short') {
                // 做空操作
                const shortCost = totalCost * 0.5; // 保证金
                if (company.gameData.inventory.money >= shortCost + tradeFee) {
                    company.gameData.inventory.money -= shortCost + tradeFee;
                    
                    if (!company.gameData.shortPositions) {
                        company.gameData.shortPositions = {};
                    }
                    
                    if (!company.gameData.shortPositions[companyId]) {
                        company.gameData.shortPositions[companyId] = [];
                    }
                    
                    company.gameData.shortPositions[companyId].push({
                        shares: tradeShares,
                        entryPrice: targetCompany.sharePrice,
                        timestamp: Date.now()
                    });
                    
                    socket.emit('stockTradeSuccess', {
                        action, companyId, shares: tradeShares,
                        message: `做空 ${targetCompany.name} ${tradeShares} 股，保证金 ${formatNumber(shortCost)} 💰`,
                        playerData: {
                            money: company.gameData.inventory.money,
                            shortPositions: company.gameData.shortPositions
                        }
                    });
                    
                    addChatMessage('金融快讯', `${company.name} 做空 ${targetCompany.name} ${formatNumber(tradeShares)} 股`);
                }
            }
            
            // 广播股价更新
            io.emit('stockPriceUpdate', {
                companyId: targetCompany.id,
                sharePrice: targetCompany.sharePrice,
                tradingVolume: targetCompany.tradingVolume
            });
            
        } catch (error) {
            console.error('stockTrade error:', error);
        }
    });
    
    // 市场交易
    socket.on('marketTrade', (data) => {
        try {
            const { action, productId, quantity, marketType, multiplier } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company || !gameState.globalMarkets[marketType] || !gameState.globalMarkets[marketType][productId]) {
                return;
            }
            
            const market = gameState.globalMarkets[marketType][productId];
            const tradeAmount = quantity * (multiplier || 1);
            
            if (action === 'buy' && company.gameData.inventory.money >= market.price * tradeAmount) {
                company.gameData.inventory.money -= market.price * tradeAmount;
                company.gameData.inventory[productId] = (company.gameData.inventory[productId] || 0) + tradeAmount;
                
                market.demand += tradeAmount;
                market.volume += tradeAmount;
                market.price = Math.max(Math.floor(market.price * 0.5), market.price + Math.floor(tradeAmount * market.price * 0.02));
                
                socket.emit('tradeSuccess', {
                    action, productId, quantity: tradeAmount, marketType,
                    message: `在${MARKET_TIERS[marketType].name}购买了${tradeAmount}个${getProductByKey(productId).name}`,
                    playerData: {
                        inventory: company.gameData.inventory
                    }
                });
                
                io.emit('marketUpdate', { marketType, market: gameState.globalMarkets[marketType] });
            }
            else if (action === 'sell' && (company.gameData.inventory[productId] || 0) >= tradeAmount) {
                const sellPrice = Math.floor(market.price * 0.95);
                company.gameData.inventory[productId] -= tradeAmount;
                company.gameData.inventory.money += sellPrice * tradeAmount;
                
                market.supply += tradeAmount;
                market.volume += tradeAmount;
                market.price = Math.max(Math.floor(market.price * 0.5), market.price - Math.floor(tradeAmount * market.price * 0.01));
                
                socket.emit('tradeSuccess', {
                    action, productId, quantity: tradeAmount, marketType,
                    message: `在${MARKET_TIERS[marketType].name}卖出了${tradeAmount}个${getProductByKey(productId).name}`,
                    playerData: {
                        inventory: company.gameData.inventory
                    }
                });
                
                io.emit('marketUpdate', { marketType, market: gameState.globalMarkets[marketType] });
            }
        } catch (error) {
            console.error('marketTrade error:', error);
        }
    });
    
    // 研发技术
    socket.on('researchTech', (data) => {
        try {
            const { techId } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company || !TECH_TREE[techId]) {
                return;
            }
            
            const tech = TECH_TREE[techId];
            
            if (company.gameData.technologies.includes(techId)) {
                socket.emit('error', { message: '技术已研发' });
                return;
            }
            
            if (tech.requires) {
                const missingTech = tech.requires.find(reqTech => !company.gameData.technologies.includes(reqTech));
                if (missingTech) {
                    socket.emit('error', { message: `需要先研发 ${TECH_TREE[missingTech].name}` });
                    return;
                }
            }
            
            if (!canAfford(company.gameData.inventory, tech.cost)) {
                socket.emit('error', { message: '资源不足，无法研发技术' });
                return;
            }
            
            payCost(company.gameData.inventory, tech.cost);
            company.gameData.technologies.push(techId);
            
            // 应用技术效果
            applyTechEffects(company.gameData, techId);
            
            socket.emit('techResearched', {
                techId: techId,
                message: `成功研发 ${tech.name}！`,
                effect: tech.effect,
                playerData: {
                    inventory: company.gameData.inventory,
                    technologies: company.gameData.technologies,
                    factories: company.gameData.factories
                }
            });
            
            addChatMessage('科技快讯', `${company.name} 研发了 ${tech.name}`);
            
        } catch (error) {
            console.error('researchTech error:', error);
        }
    });
    
    // 聊天消息
    socket.on('chatMessage', (message) => {
        try {
            const company = gameState.companies.get(socket.id);
            if (company && message && typeof message === 'string') {
                const filteredMessage = message.trim().substring(0, 200);
                if (filteredMessage.length > 0) {
                    addChatMessage(company.name, filteredMessage);
                }
            }
        } catch (error) {
            console.error('chatMessage error:', error);
        }
    });
    
    socket.on('disconnect', () => {
        try {
            const company = gameState.companies.get(socket.id);
            if (company) {
                company.online = false;
                company.lastSeen = Date.now();
                
                socket.broadcast.emit('companyLeft', {
                    id: socket.id,
                    name: company.name
                });
                
                addChatMessage('系统', `${company.name} 暂时离开了制造世界`);
                console.log(`👋 公司 ${company.name} 断开连接，数据已保存`);
                
                // 7天后删除离线公司数据
                setTimeout(() => {
                    const offlineCompany = gameState.companies.get(socket.id);
                    if (offlineCompany && !offlineCompany.online) {
                        gameState.companies.delete(socket.id);
                        gameState.playerNames.delete(offlineCompany.name);
                        console.log(`🗑️ 清理7天未上线的公司数据: ${offlineCompany.name}`);
                    }
                }, 7 * 24 * 60 * 60 * 1000);
            }
        } catch (error) {
            console.error('disconnect error:', error);
        }
    });
    
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

// 辅助函数
function createNewCompany(companyType = 'tech') {
    return {
        version: gameState.gameVersion,
        inventory: {
            money: 500000,
            // 给一些初始原料
            steel: 10,
            oil: 10,
            wood: 20,
            silicon: 5,
            wheat: 15,
            cotton: 8
        },
        factories: {},
        technologies: [],
        stockPortfolio: {}, // 股票持仓
        shortPositions: {}, // 做空持仓
        companyType: companyType,
        level: 0,
        experience: 0,
        lastUpdate: Date.now()
    };
}

function getProductByKey(productId) {
    for (const tier of Object.values(PRODUCT_TIERS)) {
        if (tier[productId]) {
            return tier[productId];
        }
    }
    return null;
}

function calculateCompanyLevel(gameData) {
    const experience = gameData.experience || 0;
    return Math.floor(experience / 1000); // 每1000经验升1级
}

function calculateCompanyValue(gameData) {
    let value = gameData.inventory.money || 0;
    
    // 库存价值
    Object.keys(gameData.inventory).forEach(productId => {
        if (productId !== 'money') {
            const product = getProductByKey(productId);
            if (product) {
                value += (gameData.inventory[productId] || 0) * product.basePrice;
            }
        }
    });
    
    // 工厂价值
    Object.keys(gameData.factories || {}).forEach(factoryType => {
        const factory = gameData.factories[factoryType];
        const factoryTypeData = FACTORY_TYPES[factory.type];
        if (factoryTypeData) {
            value += factoryTypeData.cost.money * factory.count * factory.level;
        }
    });
    
    // 股票持仓价值
    if (gameData.stockPortfolio) {
        Object.keys(gameData.stockPortfolio).forEach(companyId => {
            const shares = gameData.stockPortfolio[companyId];
            const aiCompany = gameState.aiCompanies.find(ai => ai.id === companyId);
            if (aiCompany && shares > 0) {
                value += shares * aiCompany.sharePrice;
            }
        });
    }
    
    return Math.max(0, value);
}

function canAfford(inventory, cost) {
    return Object.keys(cost).every(item => 
        (inventory[item] || 0) >= cost[item]);
}

function payCost(inventory, cost) {
    Object.keys(cost).forEach(item => {
        inventory[item] = (inventory[item] || 0) - cost[item];
    });
}

function applyTechEffects(gameData, techId) {
    switch (techId) {
        case 'efficiency_1':
            Object.keys(gameData.factories).forEach(factoryType => {
                gameData.factories[factoryType].efficiency *= 1.25;
            });
            break;
        case 'advanced_manufacturing':
            Object.keys(gameData.factories).forEach(factoryType => {
                gameData.factories[factoryType].efficiency *= 1.5;
            });
            break;
    }
}

function checkShareholdingEvent(company, targetCompany, shares, action) {
    try {
        const totalShares = company.gameData.stockPortfolio[targetCompany.id] || 0;
        const percentage = (totalShares / targetCompany.totalShares) * 100;
        
        if (action === 'buy') {
            if (percentage >= 5 && percentage < 10) {
                addNewsEvent(`📈 ${company.name} 持有 ${targetCompany.name} 5%以上股份，成为重要股东`);
                triggerShareholderEvent(company, targetCompany, 'major_shareholder');
            } else if (percentage >= 10 && percentage < 25) {
                addNewsEvent(`🔥 ${company.name} 持有 ${targetCompany.name} 10%以上股份，市场震动`);
                triggerShareholderEvent(company, targetCompany, 'large_shareholder');
            } else if (percentage >= 25) {
                addNewsEvent(`💥 ${company.name} 持有 ${targetCompany.name} 25%以上股份，可能发起收购`);
                triggerShareholderEvent(company, targetCompany, 'controlling_interest');
            }
        } else if (action === 'sell') {
            if (shares >= targetCompany.totalShares * 0.05) {
                addNewsEvent(`📉 ${company.name} 大量抛售 ${targetCompany.name} 股票，引发市场恐慌`);
                triggerShareholderEvent(company, targetCompany, 'mass_sell_off');
            }
        }
    } catch (error) {
        console.error('checkShareholdingEvent error:', error);
    }
}

function triggerShareholderEvent(company, targetCompany, eventType) {
    try {
        switch (eventType) {
            case 'major_shareholder':
                // 5%股东权益：获得分红
                const dividend = targetCompany.sharePrice * (company.gameData.stockPortfolio[targetCompany.id] || 0) * 0.02;
                company.gameData.inventory.money += dividend;
                company.socket.emit('shareholderEvent', {
                    type: 'dividend',
                    message: `作为 ${targetCompany.name} 的重要股东，获得分红 ${formatNumber(dividend)} 💰`,
                    amount: dividend
                });
                break;
                
            case 'large_shareholder':
                // 10%股东权益：影响公司股价
                targetCompany.sharePrice = Math.floor(targetCompany.sharePrice * 1.05);
                addNewsEvent(`📊 ${company.name} 的投资推高了 ${targetCompany.name} 股价`);
                break;
                
            case 'controlling_interest':
                // 25%控股权：可以影响公司决策
                const bonus = targetCompany.value * 0.01;
                company.gameData.inventory.money += bonus;
                company.socket.emit('shareholderEvent', {
                    type: 'control_bonus',
                    message: `获得 ${targetCompany.name} 控股权，获得管理奖金 ${formatNumber(bonus)} 💰`,
                    amount: bonus
                });
                break;
                
            case 'mass_sell_off':
                // 大量抛售：股价下跌
                targetCompany.sharePrice = Math.floor(targetCompany.sharePrice * 0.9);
                addNewsEvent(`💔 ${targetCompany.name} 股价因大量抛售下跌10%`);
                break;
        }
    } catch (error) {
        console.error('triggerShareholderEvent error:', error);
    }
}

function getLeaderboard() {
    try {
        const companies = Array.from(gameState.companies.values())
            .filter(company => company && company.gameData)
            .map(company => {
                const value = calculateCompanyValue(company.gameData);
                return {
                    id: company.id,
                    name: company.name || '未知公司',
                    isPlayer: true,
                    value: value,
                    level: calculateCompanyLevel(company.gameData),
                    online: company.online,
                    companyType: company.companyType || 'tech',
                    sharePrice: Math.floor(value / 1000000),
                    stockHistory: company.stockHistory || []
                };
            });
        
        const allCompanies = [...companies, ...gameState.aiCompanies.map(ai => ({
            ...ai,
            isPlayer: false,
            online: false,
            level: 5
        }))];
        
        return allCompanies.sort((a, b) => (b.value || 0) - (a.value || 0));
    } catch (error) {
        console.error('getLeaderboard error:', error);
        return [];
    }
}

function addChatMessage(playerName, message) {
    try {
        if (!playerName || !message) return;
        
        const chatMessage = {
            player: String(playerName),
            message: String(message),
            timestamp: Date.now()
        };
        
        gameState.chatMessages.push(chatMessage);
        
        if (gameState.chatMessages.length > 200) {
            gameState.chatMessages.shift();
        }
        
        io.emit('chatMessage', chatMessage);
    } catch (error) {
        console.error('addChatMessage error:', error);
    }
}

function addNewsEvent(message) {
    try {
        if (!message) return;
        
        const newsEvent = {
            message: String(message),
            timestamp: Date.now()
        };
        
        gameState.newsEvents.push(newsEvent);
        
        if (gameState.newsEvents.length > 50) {
            gameState.newsEvents.shift();
        }
        
        io.emit('newsUpdate', newsEvent);
    } catch (error) {
        console.error('addNewsEvent error:', error);
    }
}

function getOnlineStats() {
    const onlinePlayers = Array.from(gameState.companies.values()).filter(c => c.online);
    const offlinePlayers = Array.from(gameState.companies.values()).filter(c => !c.online);
    
    return {
        online: onlinePlayers.length,
        offline: offlinePlayers.length,
        total: gameState.companies.size
    };
}

function formatNumber(num) {
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1) + 'B';
    } else if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    } else {
        return Math.floor(num).toString();
    }
}

// 处理生产任务完成 - 考虑工厂数量和产能
function processProductionTasks() {
    gameState.companies.forEach(company => {
        if (!company.gameData.factories) return;
        
        Object.keys(company.gameData.factories).forEach(factoryType => {
            const factory = company.gameData.factories[factoryType];
            
            if (!factory.productionTasks) return;
            
            // 并行处理多个任务（基于工厂数量）
            const maxConcurrentTasks = Math.min(factory.count, 10); // 最多同时10个任务
            const activeTasks = factory.productionTasks.filter(task => !task.completed).slice(0, maxConcurrentTasks);
            
            activeTasks.forEach(task => {
                if (task.isReady()) {
                    const product = getProductByKey(task.productId);
                    
                    // 完成生产
                    company.gameData.inventory[task.productId] = (company.gameData.inventory[task.productId] || 0) + task.quantity;
                    company.gameData.experience = (company.gameData.experience || 0) + task.quantity * 10;
                    factory.totalProduced += task.quantity;
                    task.completed = true;
                    
                    if (company.socket) {
                        company.socket.emit('productionCompleted', {
                            taskId: task.id,
                            productId: task.productId,
                            quantity: task.quantity,
                            message: `生产完成：${product.name} x${task.quantity}`,
                            playerData: {
                                inventory: company.gameData.inventory,
                                experience: company.gameData.experience,
                                level: calculateCompanyLevel(company.gameData)
                            }
                        });
                    }
                }
                
                // 更新任务进度
                if (!task.completed) {
                    task.progress = task.getProgress();
                    
                    if (company.socket) {
                        company.socket.emit('productionProgress', {
                            factoryType: factoryType,
                            taskId: task.id,
                            progress: task.progress,
                            remainingTime: task.getRemainingTime()
                        });
                    }
                }
            });
            
            // 清理已完成的任务
            factory.productionTasks = factory.productionTasks.filter(task => !task.completed);
        });
    });
}

// 10分钟事件系统
function triggerTimedEvent() {
    try {
        if (Date.now() - gameState.lastEventTime < gameState.eventDuration) {
            return;
        }
        
        // 结束当前事件
        if (gameState.globalEvent) {
            gameState.globalEvent = null;
            addChatMessage('系统', '全球事件已结束，市场恢复正常');
            addNewsEvent('🔄 全球事件结束，市场参数恢复');
            io.emit('globalEvent', null);
        }
        
        // 随机触发新事件
        if (Math.random() < 0.7) { // 70%概率触发事件
            const event = TIMED_EVENTS[Math.floor(Math.random() * TIMED_EVENTS.length)];
            
            gameState.globalEvent = {
                ...event,
                startTime: Date.now(),
                endTime: Date.now() + event.duration
            };
            
            applyEventEffects(event);
            
            addChatMessage('全球事件', `${event.name}: ${event.description}`);
            addNewsEvent(`🌍 ${event.name} - ${event.description}`);
            io.emit('globalEvent', gameState.globalEvent);
            
            console.log(`🌍 触发10分钟事件: ${event.name}`);
        }
        
        gameState.lastEventTime = Date.now();
        
    } catch (error) {
        console.error('triggerTimedEvent error:', error);
    }
}

function applyEventEffects(event) {
    if (event.effects.marketPriceMultiplier) {
        Object.keys(event.effects.marketPriceMultiplier).forEach(category => {
            Object.keys(gameState.globalMarkets).forEach(marketType => {
                Object.keys(gameState.globalMarkets[marketType]).forEach(productId => {
                    const product = getProductByKey(productId);
                    if (product && (category === 'all' || product.category === category || getTierByProduct(productId) === category)) {
                        gameState.globalMarkets[marketType][productId].price *= event.effects.marketPriceMultiplier[category];
                    }
                });
            });
        });
    }
    
    if (event.effects.marketDemandMultiplier) {
        Object.keys(event.effects.marketDemandMultiplier).forEach(category => {
            Object.keys(gameState.globalMarkets).forEach(marketType => {
                Object.keys(gameState.globalMarkets[marketType]).forEach(productId => {
                    const product = getProductByKey(productId);
                    if (product && (product.category === category || getTierByProduct(productId) === category)) {
                        gameState.globalMarkets[marketType][productId].demand *= event.effects.marketDemandMultiplier[category];
                    }
                });
            });
        });
    }
}

function getTierByProduct(productId) {
    for (const tier of Object.keys(PRODUCT_TIERS)) {
        if (PRODUCT_TIERS[tier][productId]) {
            return tier;
        }
    }
    return null;
}

// 频繁的AI和市场变化
function updateMarketsAndAI() {
    try {
        // 更新AI公司价值和股价
        gameState.aiCompanies.forEach(company => {
            const volatility = company.volatility * (1 + Math.random() * 0.5);
            let change = (Math.random() - 0.5) * volatility * 2;
            
            // 随机突发事件
            if (Math.random() < 0.05) {
                change *= (Math.random() > 0.5 ? 3 : -3);
                const direction = change > 0 ? '暴涨' : '暴跌';
                addNewsEvent(`📊 ${company.name} 突发${direction}${Math.abs(change * 100).toFixed(1)}%！`);
            }
            
            const oldValue = company.value;
            const oldPrice = company.sharePrice;
            
            company.value = Math.max(1000000, Math.floor(company.value * (1 + change)));
            company.sharePrice = Math.max(1, Math.floor(company.sharePrice * (1 + change)));
            company.trend = change > 0.02 ? 1 : change < -0.02 ? -1 : 0;
            
            // 记录股价历史
            company.stockHistory.push({
                time: Date.now(),
                price: company.sharePrice,
                change: change,
                volume: company.tradingVolume || 0
            });
            
            if (company.stockHistory.length > 100) {
                company.stockHistory.shift();
            }
            
            // 重置交易量
            company.tradingVolume = 0;
        });
        
        // 更新市场价格
        Object.keys(gameState.globalMarkets).forEach(marketType => {
            Object.keys(gameState.globalMarkets[marketType]).forEach(productId => {
                const market = gameState.globalMarkets[marketType][productId];
                
                const supplyDemandRatio = (market.demand + 1) / (market.supply + 1);
                let priceChange = (supplyDemandRatio - 1) * 0.05;
                priceChange += (Math.random() - 0.5) * 0.08;
                
                const oldPrice = market.price;
                market.price = Math.max(Math.floor(market.price * 0.3), Math.floor(market.price * (1 + priceChange)));
                market.trend = priceChange > 0.03 ? 1 : priceChange < -0.03 ? -1 : 0;
                
                // 记录价格历史
                market.priceHistory.push({
                    time: Date.now(),
                    price: market.price
                });
                
                if (market.priceHistory.length > 50) {
                    market.priceHistory.shift();
                }
                
                // 重置供需
                market.supply = Math.max(50, market.supply * 0.95 + Math.random() * 20);
                market.demand = Math.max(30, market.demand * 0.95 + Math.random() * 30);
            });
        });
        
        io.emit('marketUpdate', gameState.globalMarkets);
        io.emit('stockUpdate', gameState.aiCompanies);
        
    } catch (error) {
        console.error('updateMarketsAndAI error:', error);
    }
}

// 定时器设置
setInterval(processProductionTasks, 1000); // 每1秒检查生产任务和更新进度
setInterval(updateMarketsAndAI, 15000); // 每15秒更新市场和AI
setInterval(triggerTimedEvent, 30000); // 每30秒检查是否触发新事件

// 更新排行榜
setInterval(() => {
    try {
        io.emit('leaderboardUpdate', getLeaderboard());
    } catch (error) {
        console.error('Leaderboard update error:', error);
    }
}, 10000);

const PORT = process.env.PORT || 3000;

server.listen(PORT, (error) => {
    if (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    } else {
        console.log(`🚀 黑心公司大亨 v2.2 服务器运行在端口 ${PORT}`);
        console.log(`🌐 访问地址: http://localhost:${PORT}`);
        console.log(`💼 等待CEO们体验全新的金融交易系统...`);
        console.log(`📊 新特性: 合并工厂 | 金融市场 | 股票交易 | 做空机制`);
    }
});

process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('收到 SIGINT 信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

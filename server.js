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

// 产品定义系统
const PRODUCT_TIERS = {
    BASIC: {
        electricity: { name: '电力', basePrice: 5, category: 'energy', productionTime: 2 },
        water: { name: '水', basePrice: 3, category: 'basic', productionTime: 3, recipe: { electricity: 1 } },
        iron_ore: { name: '铁矿石', basePrice: 20, category: 'raw', productionTime: 4 },
        oil_crude: { name: '原油', basePrice: 30, category: 'raw', productionTime: 5 },
        sand: { name: '沙子', basePrice: 10, category: 'raw', productionTime: 2 },
        wood_raw: { name: '原木', basePrice: 15, category: 'raw', productionTime: 3 },
        apple: { name: '苹果', basePrice: 8, category: 'agriculture', productionTime: 6 },
        wheat: { name: '小麦', basePrice: 12, category: 'agriculture', productionTime: 7 },
        cotton: { name: '棉花', basePrice: 18, category: 'agriculture', productionTime: 8 }
    },
    T1: {
        steel: { name: '钢铁', basePrice: 50, category: 'material', recipe: { iron_ore: 3, electricity: 2 }, productionTime: 12 },
        plastic: { name: '塑料', basePrice: 40, category: 'material', recipe: { oil_crude: 2, electricity: 1 }, productionTime: 10 },
        glass: { name: '玻璃', basePrice: 35, category: 'material', recipe: { sand: 4, electricity: 3 }, productionTime: 14 },
        lumber: { name: '木材', basePrice: 25, category: 'material', recipe: { wood_raw: 2, electricity: 1 }, productionTime: 8 },
        fuel: { name: '燃料', basePrice: 45, category: 'energy', recipe: { oil_crude: 3, electricity: 1 }, productionTime: 11 },
        apple_juice: { name: '苹果汁', basePrice: 20, category: 'beverage', recipe: { apple: 4, water: 2, electricity: 1 }, productionTime: 10 },
        flour: { name: '面粉', basePrice: 30, category: 'food', recipe: { wheat: 3, electricity: 2 }, productionTime: 12 },
        fabric: { name: '布料', basePrice: 60, category: 'textile', recipe: { cotton: 2, water: 3, electricity: 2 }, productionTime: 16 }
    },
    T2: {
        silicon_chip: { name: '硅芯片', basePrice: 200, category: 'tech', recipe: { sand: 5, electricity: 8, steel: 1 }, productionTime: 35 },
        engine: { name: '发动机', basePrice: 500, category: 'mechanical', recipe: { steel: 8, fuel: 3, electricity: 5 }, productionTime: 45 },
        electronic_board: { name: '电路板', basePrice: 150, category: 'tech', recipe: { silicon_chip: 2, plastic: 3, electricity: 4 }, productionTime: 30 },
        window: { name: '窗户', basePrice: 80, category: 'construction', recipe: { glass: 3, steel: 1, electricity: 2 }, productionTime: 20 },
        furniture: { name: '家具', basePrice: 120, category: 'home', recipe: { lumber: 5, fabric: 2, electricity: 3 }, productionTime: 40 },
        cola: { name: '可乐', basePrice: 15, category: 'beverage', recipe: { apple_juice: 1, water: 3, electricity: 1 }, productionTime: 15 },
        bread: { name: '面包', basePrice: 25, category: 'food', recipe: { flour: 2, water: 1, electricity: 2 }, productionTime: 18 },
        clothing: { name: '服装', basePrice: 100, category: 'consumer', recipe: { fabric: 3, plastic: 1, electricity: 2 }, productionTime: 32 }
    },
    T3: {
        smartphone: { name: '智能手机', basePrice: 800, category: 'consumer', recipe: { silicon_chip: 5, electronic_board: 3, plastic: 2, electricity: 10 }, productionTime: 70 },
        car: { name: '汽车', basePrice: 15000, category: 'consumer', recipe: { engine: 1, steel: 20, window: 6, electronic_board: 2, fuel: 5, electricity: 15 }, productionTime: 150 },
        computer: { name: '计算机', basePrice: 1200, category: 'tech', recipe: { silicon_chip: 8, electronic_board: 5, plastic: 4, electricity: 12 }, productionTime: 90 },
        house: { name: '房屋', basePrice: 50000, category: 'real_estate', recipe: { steel: 100, lumber: 50, window: 20, furniture: 10, electricity: 30 }, productionTime: 360 },
        restaurant_meal: { name: '餐厅餐点', basePrice: 35, category: 'food', recipe: { bread: 2, cola: 1, electricity: 3 }, productionTime: 25 },
        fashion_brand: { name: '时尚品牌', basePrice: 300, category: 'luxury', recipe: { clothing: 3, furniture: 1, electricity: 5 }, productionTime: 110 }
    },
    T4: {
        luxury_car: { name: '豪华汽车', basePrice: 80000, category: 'luxury', recipe: { car: 1, silicon_chip: 20, electronic_board: 10, electricity: 25 }, productionTime: 240 },
        premium_phone: { name: '高端手机', basePrice: 2500, category: 'luxury', recipe: { smartphone: 1, silicon_chip: 10, electricity: 15 }, productionTime: 140 },
        mansion: { name: '豪宅', basePrice: 500000, category: 'luxury', recipe: { house: 1, luxury_car: 1, fashion_brand: 5, electricity: 50 }, productionTime: 720 },
        private_jet: { name: '私人飞机', basePrice: 5000000, category: 'luxury', recipe: { engine: 20, electronic_board: 50, steel: 200, fuel: 100, electricity: 100 }, productionTime: 1440 }
    }
};

// 工厂类型定义
const FACTORY_TYPES = {
    power_plant: {
        name: '发电厂',
        emoji: '⚡',
        cost: { money: 50000 },
        produces: ['electricity'],
        description: '生产电力，其他工厂的基础',
        category: 'power',
        efficiency: 1.0,
        powerConsumption: 1
    },
    water_plant: {
        name: '水厂',
        emoji: '💧',
        cost: { money: 80000 },
        produces: ['water'],
        description: '净化处理水源',
        category: 'utility',
        efficiency: 1.0,
        powerConsumption: 3
    },
    iron_mine: {
        name: '铁矿',
        emoji: '⛏️',
        cost: { money: 100000 },
        produces: ['iron_ore'],
        description: '开采铁矿石',
        category: 'mining',
        efficiency: 1.0,
        powerConsumption: 2
    },
    oil_well: {
        name: '油井',
        emoji: '🛢️',
        cost: { money: 150000 },
        produces: ['oil_crude'],
        description: '开采原油',
        category: 'mining',
        efficiency: 1.0,
        powerConsumption: 4
    },
    sand_pit: {
        name: '沙坑',
        emoji: '🏖️',
        cost: { money: 30000 },
        produces: ['sand'],
        description: '采集沙子',
        category: 'mining',
        efficiency: 1.0,
        powerConsumption: 1
    },
    lumber_mill: {
        name: '伐木场',
        emoji: '🌲',
        cost: { money: 60000 },
        produces: ['wood_raw'],
        description: '砍伐原木',
        category: 'forestry',
        efficiency: 1.0,
        powerConsumption: 2
    },
    apple_farm: {
        name: '苹果农场',
        emoji: '🍎',
        cost: { money: 40000 },
        produces: ['apple'],
        description: '种植苹果',
        category: 'agriculture',
        efficiency: 1.0,
        powerConsumption: 2
    },
    wheat_farm: {
        name: '小麦农场',
        emoji: '🌾',
        cost: { money: 45000 },
        produces: ['wheat'],
        description: '种植小麦',
        category: 'agriculture',
        efficiency: 1.0,
        powerConsumption: 2
    },
    cotton_farm: {
        name: '棉花农场',
        emoji: '🌸',
        cost: { money: 50000 },
        produces: ['cotton'],
        description: '种植棉花',
        category: 'agriculture',
        efficiency: 1.0,
        powerConsumption: 2
    },
    steel_mill: {
        name: '钢铁厂',
        emoji: '🏭',
        cost: { money: 200000, iron_ore: 50 },
        produces: ['steel'],
        description: '冶炼钢铁',
        category: 'processing',
        efficiency: 1.0,
        powerConsumption: 6
    },
    petrochemical: {
        name: '石化厂',
        emoji: '🧪',
        cost: { money: 250000, oil_crude: 30 },
        produces: ['plastic', 'fuel'],
        description: '石油化工产品',
        category: 'processing',
        efficiency: 1.0,
        powerConsumption: 8
    },
    glass_factory: {
        name: '玻璃厂',
        emoji: '🏗️',
        cost: { money: 180000, sand: 100 },
        produces: ['glass'],
        description: '制造玻璃',
        category: 'processing',
        efficiency: 1.0,
        powerConsumption: 7
    },
    sawmill: {
        name: '锯木厂',
        emoji: '🪚',
        cost: { money: 120000, wood_raw: 50 },
        produces: ['lumber'],
        description: '加工木材',
        category: 'processing',
        efficiency: 1.0,
        powerConsumption: 4
    },
    juice_factory: {
        name: '果汁厂',
        emoji: '🧃',
        cost: { money: 90000, apple: 100 },
        produces: ['apple_juice'],
        description: '生产果汁',
        category: 'food_processing',
        efficiency: 1.0,
        powerConsumption: 5
    },
    flour_mill: {
        name: '面粉厂',
        emoji: '🌾',
        cost: { money: 100000, wheat: 80 },
        produces: ['flour'],
        description: '磨制面粉',
        category: 'food_processing',
        efficiency: 1.0,
        powerConsumption: 5
    },
    textile_mill: {
        name: '纺织厂',
        emoji: '🧵',
        cost: { money: 150000, cotton: 60 },
        produces: ['fabric'],
        description: '纺织布料',
        category: 'textile',
        efficiency: 1.0,
        powerConsumption: 6
    },
    semiconductor: {
        name: '半导体厂',
        emoji: '💻',
        cost: { money: 500000, steel: 30, glass: 20 },
        produces: ['silicon_chip'],
        description: '制造芯片',
        category: 'high_tech',
        efficiency: 1.0,
        powerConsumption: 15
    },
    engine_factory: {
        name: '发动机厂',
        emoji: '🔧',
        cost: { money: 400000, steel: 50 },
        produces: ['engine'],
        description: '制造发动机',
        category: 'mechanical',
        efficiency: 1.0,
        powerConsumption: 12
    },
    electronics: {
        name: '电子厂',
        emoji: '📱',
        cost: { money: 350000, silicon_chip: 10, plastic: 20 },
        produces: ['electronic_board'],
        description: '制造电路板',
        category: 'electronics',
        efficiency: 1.0,
        powerConsumption: 10
    },
    construction: {
        name: '建材厂',
        emoji: '🏗️',
        cost: { money: 200000, glass: 30, steel: 20 },
        produces: ['window'],
        description: '制造建筑材料',
        category: 'construction',
        efficiency: 1.0,
        powerConsumption: 8
    },
    furniture_factory: {
        name: '家具厂',
        emoji: '🪑',
        cost: { money: 180000, lumber: 40, fabric: 20 },
        produces: ['furniture'],
        description: '制造家具',
        category: 'home',
        efficiency: 1.0,
        powerConsumption: 7
    },
    beverage_factory: {
        name: '饮料厂',
        emoji: '🥤',
        cost: { money: 120000, apple_juice: 50 },
        produces: ['cola'],
        description: '生产饮料',
        category: 'beverage',
        efficiency: 1.0,
        powerConsumption: 6
    },
    bakery: {
        name: '面包厂',
        emoji: '🍞',
        cost: { money: 80000, flour: 40 },
        produces: ['bread'],
        description: '烘焙面包',
        category: 'food',
        efficiency: 1.0,
        powerConsumption: 5
    },
    garment_factory: {
        name: '服装厂',
        emoji: '👕',
        cost: { money: 160000, fabric: 30, plastic: 10 },
        produces: ['clothing'],
        description: '制造服装',
        category: 'apparel',
        efficiency: 1.0,
        powerConsumption: 7
    },
    phone_assembly: {
        name: '手机组装厂',
        emoji: '📱',
        cost: { money: 800000, silicon_chip: 20, electronic_board: 15 },
        produces: ['smartphone'],
        description: '组装智能手机',
        category: 'assembly',
        efficiency: 1.0,
        powerConsumption: 20
    },
    auto_assembly: {
        name: '汽车组装厂',
        emoji: '🚗',
        cost: { money: 1500000, engine: 5, steel: 100 },
        produces: ['car'],
        description: '组装汽车',
        category: 'assembly',
        efficiency: 1.0,
        powerConsumption: 30
    },
    computer_assembly: {
        name: '电脑组装厂',
        emoji: '💻',
        cost: { money: 600000, silicon_chip: 30, electronic_board: 20 },
        produces: ['computer'],
        description: '组装计算机',
        category: 'assembly',
        efficiency: 1.0,
        powerConsumption: 25
    },
    construction_company: {
        name: '建筑公司',
        emoji: '🏠',
        cost: { money: 2000000, steel: 200, lumber: 100 },
        produces: ['house'],
        description: '建造房屋',
        category: 'construction',
        efficiency: 1.0,
        powerConsumption: 50
    },
    restaurant: {
        name: '餐厅',
        emoji: '🍽️',
        cost: { money: 300000, bread: 50, cola: 30 },
        produces: ['restaurant_meal'],
        description: '提供餐饮服务',
        category: 'service',
        efficiency: 1.0,
        powerConsumption: 15
    },
    fashion_house: {
        name: '时尚工作室',
        emoji: '👗',
        cost: { money: 400000, clothing: 20, furniture: 10 },
        produces: ['fashion_brand'],
        description: '设计时尚产品',
        category: 'luxury',
        efficiency: 1.0,
        powerConsumption: 18
    },
    luxury_auto: {
        name: '豪车工厂',
        emoji: '🏎️',
        cost: { money: 5000000, car: 10, silicon_chip: 50 },
        produces: ['luxury_car'],
        description: '制造豪华汽车',
        category: 'luxury',
        efficiency: 1.0,
        powerConsumption: 60
    },
    premium_electronics: {
        name: '高端电子厂',
        emoji: '📱',
        cost: { money: 3000000, smartphone: 20, silicon_chip: 100 },
        produces: ['premium_phone'],
        description: '制造高端手机',
        category: 'luxury',
        efficiency: 1.0,
        powerConsumption: 45
    },
    luxury_real_estate: {
        name: '豪宅开发商',
        emoji: '🏰',
        cost: { money: 20000000, house: 5, luxury_car: 2 },
        produces: ['mansion'],
        description: '开发豪宅',
        category: 'luxury',
        efficiency: 1.0,
        powerConsumption: 100
    },
    aerospace: {
        name: '航空制造厂',
        emoji: '✈️',
        cost: { money: 50000000, engine: 100, electronic_board: 200 },
        produces: ['private_jet'],
        description: '制造私人飞机',
        category: 'aerospace',
        efficiency: 1.0,
        powerConsumption: 200
    }
};

// 市场层级定义
const MARKET_TIERS = {
    local: {
        name: '本地市场',
        emoji: '🏪',
        allowedTiers: ['BASIC', 'T1'],
        priceMultiplier: 0.8,
        demandMultiplier: 2.0,
        description: '起步市场，价格较低但需求稳定'
    },
    domestic: {
        name: '国内市场',
        emoji: '🇨🇳',
        allowedTiers: ['BASIC', 'T1', 'T2'],
        priceMultiplier: 1.0,
        demandMultiplier: 1.5,
        description: '国内大市场，价格合理'
    },
    international: {
        name: '国际市场',
        emoji: '🌍',
        allowedTiers: ['T1', 'T2', 'T3'],
        priceMultiplier: 1.3,
        demandMultiplier: 1.0,
        description: '国际市场，高价但竞争激烈'
    },
    luxury: {
        name: '奢侈品市场',
        emoji: '💎',
        allowedTiers: ['T3', 'T4'],
        priceMultiplier: 2.0,
        demandMultiplier: 0.3,
        description: '高端市场，暴利但需求极少'
    }
};

// 科技树定义
const TECH_TREE = {
    power_efficiency: {
        name: '电力效率优化',
        cost: { money: 100000, electricity: 50 },
        effect: '所有工厂电力消耗-20%',
        description: '优化电力使用效率',
        category: 'efficiency'
    },
    automation_basic: {
        name: '基础自动化',
        cost: { money: 200000, electronic_board: 10 },
        effect: '工厂生产效率+25%',
        description: '基础生产自动化',
        category: 'automation'
    },
    supply_chain: {
        name: '供应链优化',
        cost: { money: 300000, computer: 5 },
        effect: '原料消耗-15%',
        description: '优化供应链管理',
        category: 'logistics'
    },
    quality_control: {
        name: '质量控制',
        cost: { money: 400000, silicon_chip: 20 },
        effect: '产品价值+30%',
        description: '建立质量管控体系',
        category: 'quality'
    },
    advanced_automation: {
        name: '高级自动化',
        cost: { money: 1000000, computer: 20 },
        requires: ['automation_basic', 'power_efficiency'],
        effect: '工厂效率+50%，支持批量操作',
        description: '高级自动化系统',
        category: 'automation'
    },
    ai_optimization: {
        name: 'AI智能优化',
        cost: { money: 2000000, premium_phone: 10 },
        requires: ['advanced_automation', 'supply_chain'],
        effect: '全面优化，效率+100%',
        description: 'AI驱动的智能优化',
        category: 'ai'
    }
};

// 游戏状态
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
            volatility: 0.25,
            underAttack: false,
            specialty: 'electronics',
            stockHistory: [],
            sharePrice: 180,
            totalShares: 1000000,
            tradingVolume: 0,
            momentum: 0,
            shockEvents: [],
            lastChange: 0,
            priceHistory: [180]
        },
        {
            id: 'ai_micro_soft',
            name: '微硬公司',
            value: 165000000,
            trend: 0,
            sector: '软件',
            companyType: 'tech',
            volatility: 0.18,
            underAttack: false,
            specialty: 'software',
            stockHistory: [],
            sharePrice: 165,
            totalShares: 1000000,
            tradingVolume: 0,
            momentum: 0,
            shockEvents: [],
            lastChange: 0,
            priceHistory: [165]
        },
        {
            id: 'ai_google_search',
            name: '谷歌搜索',
            value: 170000000,
            trend: -1,
            sector: '互联网',
            companyType: 'tech',
            volatility: 0.20,
            underAttack: false,
            specialty: 'data_services',
            stockHistory: [],
            sharePrice: 170,
            totalShares: 1000000,
            tradingVolume: 0,
            momentum: 0,
            shockEvents: [],
            lastChange: 0,
            priceHistory: [170]
        },
        {
            id: 'ai_tesla_auto',
            name: '特斯拉汽车',
            value: 95000000,
            trend: 1,
            sector: '汽车',
            companyType: 'manufacturing',
            volatility: 0.35,
            underAttack: false,
            specialty: 'automotive',
            stockHistory: [],
            sharePrice: 95,
            totalShares: 1000000,
            tradingVolume: 0,
            momentum: 0,
            shockEvents: [],
            lastChange: 0,
            priceHistory: [95]
        },
        {
            id: 'ai_amazon_retail',
            name: '亚马逊零售',
            value: 140000000,
            trend: 0,
            sector: '电商',
            companyType: 'retail',
            volatility: 0.15,
            underAttack: false,
            specialty: 'logistics',
            stockHistory: [],
            sharePrice: 140,
            totalShares: 1000000,
            tradingVolume: 0,
            momentum: 0,
            shockEvents: [],
            lastChange: 0,
            priceHistory: [140]
        }
    ],
    globalMarkets: {},
    marketContracts: [],
    alliances: [],
    globalEvent: null,
    chatMessages: [],
    newsEvents: [],
    serverStartTime: Date.now(),
    lastEventTime: Date.now(),
    eventDuration: 10 * 60 * 1000,
    gameVersion: '2.3.1',
    stockPriceHistory: {
        labels: [],
        datasets: {}
    }
};

// 初始化市场
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

// 初始化所有市场
Object.keys(MARKET_TIERS).forEach(marketType => {
    gameState.globalMarkets[marketType] = initializeMarket(marketType);
});

// 生产任务类
class ProductionTask {
    constructor(factoryType, productId, quantity, companyId) {
        this.id = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.factoryType = factoryType;
        this.productId = productId;
        this.quantity = quantity;
        this.companyId = companyId;
        this.startTime = Date.now();
        this.completed = false;
        this.paused = false;
        this.pausedDuration = 0;
        
        const product = this.getProductInfo();
        this.totalTime = product.productionTime * 1000 * quantity;
        this.baseCompletionTime = this.startTime + this.totalTime;
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
    
    getCompletionTime() {
        return this.baseCompletionTime + this.pausedDuration;
    }
    
    isReady() {
        if (this.paused || this.completed) return false;
        return Date.now() >= this.getCompletionTime();
    }
    
    getProgress() {
        if (this.completed) return 1;
        if (this.paused) return this.progress;
        
        const elapsed = Date.now() - this.startTime - this.pausedDuration;
        const progress = Math.min(elapsed / this.totalTime, 1);
        this.progress = progress;
        return progress;
    }
    
    getRemainingTime() {
        if (this.completed) return 0;
        if (this.paused) return this.totalTime * (1 - this.progress);
        
        return Math.max(0, this.getCompletionTime() - Date.now());
    }
    
    pause() {
        if (!this.paused && !this.completed) {
            this.paused = true;
            this.pauseStartTime = Date.now();
            this.progress = this.getProgress();
        }
    }
    
    resume() {
        if (this.paused) {
            this.pausedDuration += Date.now() - this.pauseStartTime;
            this.paused = false;
            delete this.pauseStartTime;
        }
    }
}

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Socket连接处理
io.on('connection', (socket) => {
    console.log('🔗 新CEO连接:', socket.id);
    
    socket.on('joinGame', (data) => {
        try {
            const { companyName, playerName, companyType } = data;
            
            if (!companyName || !playerName) {
                socket.emit('error', { message: '公司名称和玩家名称不能为空' });
                return;
            }
            
            const initialSharePrice = Math.floor(Math.random() * 50 + 50); // 50-100的随机初始股价
            
            const companyData = {
                id: socket.id,
                name: companyName,
                playerName: playerName,
                companyType: companyType || 'tech',
                gameData: createNewCompany(companyType),
                online: true,
                lastSeen: Date.now(),
                socket: socket,
                sharePrice: initialSharePrice,
                totalShares: 1000000,
                availableShares: 1000000,
                priceHistory: [initialSharePrice],
                lastChange: 0,
                volatility: 0.15,
                momentum: 0
            };
            
            gameState.companies.set(socket.id, companyData);
            gameState.playerNames.set(companyName, socket.id);
            
            // 添加玩家公司到排行榜
            updateLeaderboard();
            
            socket.emit('gameState', {
                globalMarkets: gameState.globalMarkets,
                leaderboard: getLeaderboard(),
                chatMessages: gameState.chatMessages.slice(-50),
                globalEvent: gameState.globalEvent,
                productTiers: PRODUCT_TIERS,
                factoryTypes: FACTORY_TYPES,
                marketTiers: MARKET_TIERS,
                techTree: TECH_TREE,
                aiCompanies: gameState.aiCompanies,
                playerCompanies: getPlayerCompaniesForClient(),
                stockPriceHistory: gameState.stockPriceHistory
            });
            
            // 广播聊天消息
            broadcastChatMessage('系统', `${companyName} 的CEO加入了游戏`, 'system');
            
            // 广播股价更新
            broadcastStockPrices();
            
        } catch (error) {
            console.error('joinGame error:', error);
            socket.emit('error', { message: '加入游戏失败' });
        }
    });
    
    socket.on('buildFactory', (data) => {
        try {
            const { factoryType, quantity = 1 } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company || !FACTORY_TYPES[factoryType]) {
                return;
            }
            
            const factory = FACTORY_TYPES[factoryType];
            const totalCost = {};
            
            Object.keys(factory.cost).forEach(item => {
                totalCost[item] = factory.cost[item] * quantity;
            });
            
            if (!canAfford(company.gameData.inventory, totalCost)) {
                socket.emit('error', { message: '资源不足，无法建造工厂' });
                return;
            }
            
            payCost(company.gameData.inventory, totalCost);
            
            if (!company.gameData.factories[factoryType]) {
                company.gameData.factories[factoryType] = {
                    type: factoryType,
                    count: 0,
                    level: 1,
                    efficiency: factory.efficiency,
                    productionTasks: [],
                    totalProduced: 0,
                    powerConsumption: factory.powerConsumption
                };
            }
            
            company.gameData.factories[factoryType].count += quantity;
            
            socket.emit('factoryBuilt', {
                factoryType: factoryType,
                quantity: quantity,
                message: `成功建造 ${quantity} 个 ${factory.name}！`,
                playerData: {
                    inventory: company.gameData.inventory,
                    factories: company.gameData.factories
                }
            });
            
            updateLeaderboard();
            broadcastStockPrices();
            
        } catch (error) {
            console.error('buildFactory error:', error);
        }
    });
    
    socket.on('startProduction', (data) => {
        try {
            const { factoryType, productId, quantity } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company || !company.gameData.factories[factoryType]) {
                socket.emit('error', { message: '工厂不存在' });
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
            
            const product = getProductByKey(productId);
            if (!product) {
                socket.emit('error', { message: '未知产品' });
                return;
            }
            
            // 检查电力供应
            const powerRequired = factoryTypeData.powerConsumption || 0;
            const currentPowerConsumption = calculateTotalPowerConsumption(company);
            const powerProduction = calculatePowerProduction(company);
            
            if (currentPowerConsumption + powerRequired > powerProduction) {
                socket.emit('error', { message: '电力不足，请先建造更多发电厂' });
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
            
            if (!factory.productionTasks) factory.productionTasks = [];
            factory.productionTasks.push(task);
            
            socket.emit('productionStarted', {
                task: {
                    id: task.id,
                    productId: task.productId,
                    quantity: task.quantity,
                    completionTime: task.getCompletionTime(),
                    progress: task.getProgress(),
                    remainingTime: task.getRemainingTime(),
                    paused: task.paused
                },
                playerData: {
                    inventory: company.gameData.inventory,
                    factories: company.gameData.factories
                }
            });
            
        } catch (error) {
            console.error('startProduction error:', error);
            socket.emit('error', { message: '生产启动失败' });
        }
    });
    
    // 修复市场交易
    socket.on('marketTrade', (data) => {
        try {
            const { action, productId, marketType, multiplier = 1 } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company || !gameState.globalMarkets[marketType] || !gameState.globalMarkets[marketType][productId]) {
                socket.emit('error', { message: '无效的交易参数' });
                return;
            }
            
            const market = gameState.globalMarkets[marketType][productId];
            const product = getProductByKey(productId);
            
            if (action === 'buy') {
                const totalCost = market.price * multiplier;
                if (company.gameData.inventory.money < totalCost) {
                    socket.emit('error', { message: '资金不足' });
                    return;
                }
                
                company.gameData.inventory.money -= totalCost;
                company.gameData.inventory[productId] = (company.gameData.inventory[productId] || 0) + multiplier;
                
                market.demand -= multiplier;
                market.price = Math.floor(market.price * 1.01);
                
                socket.emit('tradeSuccess', {
                    message: `成功购买 ${multiplier} 个 ${product.name}`,
                    playerData: { inventory: company.gameData.inventory }
                });
                
            } else if (action === 'sell') {
                const ownedQuantity = company.gameData.inventory[productId] || 0;
                if (ownedQuantity < multiplier) {
                    socket.emit('error', { message: '库存不足' });
                    return;
                }
                
                const totalRevenue = market.price * multiplier;
                company.gameData.inventory.money += totalRevenue;
                company.gameData.inventory[productId] -= multiplier;
                
                market.supply += multiplier;
                market.price = Math.floor(market.price * 0.99);
                
                socket.emit('tradeSuccess', {
                    message: `成功出售 ${multiplier} 个 ${product.name}，获得 ${totalRevenue} 💰`,
                    playerData: { inventory: company.gameData.inventory }
                });
            }
            
            updateLeaderboard();
            broadcastStockPrices();
            io.emit('marketUpdate', { marketType, market: gameState.globalMarkets[marketType] });
            
        } catch (error) {
            console.error('marketTrade error:', error);
            socket.emit('error', { message: '交易失败' });
        }
    });
    
    // 修复股票交易
    socket.on('stockTrade', (data) => {
        try {
            const { action, companyId, multiplier = 1, leverage = 1 } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company) {
                socket.emit('error', { message: '无效的公司' });
                return;
            }
            
            let targetCompany = null;
            let isPlayerCompany = false;
            
            // 查找目标公司（AI公司或玩家公司）
            targetCompany = gameState.aiCompanies.find(ai => ai.id === companyId);
            if (!targetCompany) {
                targetCompany = Array.from(gameState.companies.values()).find(c => c.id === companyId);
                isPlayerCompany = true;
            }
            
            if (!targetCompany) {
                socket.emit('error', { message: '未找到目标公司' });
                return;
            }
            
            const sharePrice = targetCompany.sharePrice;
            const totalCost = sharePrice * multiplier;
            
            if (action === 'buy') {
                if (isPlayerCompany) {
                    // 购买玩家公司股票，检查占有率限制
                    const currentShares = company.gameData.stockPortfolio[companyId] || 0;
                    const newTotalShares = currentShares + multiplier;
                    const ownershipPercent = (newTotalShares / targetCompany.totalShares) * 100;
                    
                    if (ownershipPercent > 49) {
                        socket.emit('error', { message: '不能持有超过49%的股份' });
                        return;
                    }
                    
                    if (targetCompany.availableShares < multiplier) {
                        socket.emit('error', { message: '可用股份不足' });
                        return;
                    }
                }
                
                if (company.gameData.inventory.money < totalCost) {
                    socket.emit('error', { message: '资金不足' });
                    return;
                }
                
                company.gameData.inventory.money -= totalCost;
                
                if (!company.gameData.stockPortfolio) {
                    company.gameData.stockPortfolio = {};
                }
                company.gameData.stockPortfolio[companyId] = (company.gameData.stockPortfolio[companyId] || 0) + multiplier;
                
                if (isPlayerCompany) {
                    targetCompany.availableShares -= multiplier;
                }
                
                socket.emit('tradeSuccess', {
                    message: `成功购买 ${multiplier} 股 ${targetCompany.name}`,
                    playerData: { 
                        inventory: company.gameData.inventory,
                        stockPortfolio: company.gameData.stockPortfolio
                    }
                });
                
            } else if (action === 'sell') {
                const ownedShares = company.gameData.stockPortfolio[companyId] || 0;
                if (ownedShares < multiplier) {
                    socket.emit('error', { message: '持股不足' });
                    return;
                }
                
                company.gameData.inventory.money += totalCost;
                company.gameData.stockPortfolio[companyId] -= multiplier;
                
                if (isPlayerCompany) {
                    targetCompany.availableShares += multiplier;
                }
                
                socket.emit('tradeSuccess', {
                    message: `成功出售 ${multiplier} 股 ${targetCompany.name}，获得 ${totalCost} 💰`,
                    playerData: { 
                        inventory: company.gameData.inventory,
                        stockPortfolio: company.gameData.stockPortfolio
                    }
                });
            }
            
            updateLeaderboard();
            broadcastStockPrices();
            
        } catch (error) {
            console.error('stockTrade error:', error);
            socket.emit('error', { message: '股票交易失败' });
        }
    });
    
    // 修复借贷系统
    socket.on('requestLoan', (data) => {
        try {
            const { amount, leverage = 1 } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company) {
                socket.emit('error', { message: '无效的公司' });
                return;
            }
            
            const netWorth = Math.max(company.gameData.inventory.money - (company.gameData.debt || 0), 100000);
            const maxLoanAmount = netWorth * 5;
            
            if (amount > maxLoanAmount) {
                socket.emit('error', { message: `借贷金额不能超过净资产的5倍 (${Math.floor(maxLoanAmount)} 💰)` });
                return;
            }
            
            const interestRate = 0.05 + (leverage - 1) * 0.02;
            const monthlyPayment = amount * (interestRate / 12 + 0.01);
            
            const loan = {
                id: 'loan_' + Date.now(),
                amount: amount,
                interestRate: interestRate,
                leverage: leverage,
                monthlyPayment: monthlyPayment,
                remainingAmount: amount,
                startDate: Date.now()
            };
            
            if (!company.gameData.loans) {
                company.gameData.loans = [];
            }
            company.gameData.loans.push(loan);
            
            company.gameData.inventory.money += amount;
            company.gameData.debt = (company.gameData.debt || 0) + amount;
            
            socket.emit('loanApproved', {
                message: `贷款申请成功！获得 ${amount} 💰，${leverage}x杠杆`,
                loan: loan,
                playerData: {
                    inventory: company.gameData.inventory,
                    loans: company.gameData.loans,
                    debt: company.gameData.debt
                }
            });
            
            updateLeaderboard();
            broadcastStockPrices();
            
        } catch (error) {
            console.error('requestLoan error:', error);
            socket.emit('error', { message: '贷款申请失败' });
        }
    });
    
    socket.on('repayLoan', (data) => {
        try {
            const { loanId, amount } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company || !company.gameData.loans) {
                socket.emit('error', { message: '无效的贷款' });
                return;
            }
            
            const loanIndex = company.gameData.loans.findIndex(loan => loan.id === loanId);
            if (loanIndex === -1) {
                socket.emit('error', { message: '贷款不存在' });
                return;
            }
            
            const loan = company.gameData.loans[loanIndex];
            const repayAmount = Math.min(amount, loan.remainingAmount);
            
            if (company.gameData.inventory.money < repayAmount) {
                socket.emit('error', { message: '资金不足以偿还贷款' });
                return;
            }
            
            company.gameData.inventory.money -= repayAmount;
            loan.remainingAmount -= repayAmount;
            company.gameData.debt = Math.max(0, company.gameData.debt - repayAmount);
            
            if (loan.remainingAmount <= 0) {
                company.gameData.loans.splice(loanIndex, 1);
            }
            
            socket.emit('loanRepaid', {
                message: `成功偿还贷款 ${repayAmount} 💰`,
                playerData: {
                    inventory: company.gameData.inventory,
                    loans: company.gameData.loans,
                    debt: company.gameData.debt
                }
            });
            
            updateLeaderboard();
            broadcastStockPrices();
            
        } catch (error) {
            console.error('repayLoan error:', error);
            socket.emit('error', { message: '还款失败' });
        }
    });
    
    // 修复聊天系统
    socket.on('chatMessage', (message) => {
        try {
            const company = gameState.companies.get(socket.id);
            if (!company || !message || message.trim() === '') {
                return;
            }
            
            const cleanMessage = message.trim().substring(0, 200);
            broadcastChatMessage(company.name, cleanMessage, 'player');
            
        } catch (error) {
            console.error('chatMessage error:', error);
        }
    });
    
    socket.on('researchTech', (data) => {
        try {
            const { techId } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company || !TECH_TREE[techId]) {
                socket.emit('error', { message: '无效的科技' });
                return;
            }
            
            const tech = TECH_TREE[techId];
            
            if (company.gameData.technologies.includes(techId)) {
                socket.emit('error', { message: '已经研发过此科技' });
                return;
            }
            
            if (tech.requires && !tech.requires.every(reqTech => company.gameData.technologies.includes(reqTech))) {
                socket.emit('error', { message: '不满足前置科技要求' });
                return;
            }
            
            if (!canAfford(company.gameData.inventory, tech.cost)) {
                socket.emit('error', { message: '研发资源不足' });
                return;
            }
            
            payCost(company.gameData.inventory, tech.cost);
            company.gameData.technologies.push(techId);
            
            socket.emit('techResearched', {
                message: `成功研发 ${tech.name}！`,
                techId: techId,
                playerData: {
                    inventory: company.gameData.inventory,
                    technologies: company.gameData.technologies
                }
            });
            
            updateLeaderboard();
            broadcastStockPrices();
            
        } catch (error) {
            console.error('researchTech error:', error);
            socket.emit('error', { message: '研发失败' });
        }
    });
    
    socket.on('disconnect', () => {
        try {
            const company = gameState.companies.get(socket.id);
            if (company) {
                company.online = false;
                company.lastSeen = Date.now();
                console.log(`👋 公司 ${company.name} 断开连接`);
                
                broadcastChatMessage('系统', `${company.name} 的CEO离开了游戏`, 'system');
                updateLeaderboard();
                broadcastStockPrices();
            }
        } catch (error) {
            console.error('disconnect error:', error);
        }
    });
});

// 辅助函数
function createNewCompany(companyType = 'tech') {
    return {
        version: gameState.gameVersion,
        inventory: {
            money: 1000000,
            electricity: 100,
            water: 50,
            iron_ore: 20,
            oil_crude: 15,
            sand: 30,
            wood_raw: 25
        },
        factories: {},
        technologies: [],
        stockPortfolio: {},
        loans: [],
        debt: 0,
        companyType: companyType,
        level: 0,
        experience: 0,
        lastUpdate: Date.now(),
        bankrupt: false
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

function canAfford(inventory, cost) {
    return Object.keys(cost).every(item => 
        (inventory[item] || 0) >= cost[item]);
}

function payCost(inventory, cost) {
    Object.keys(cost).forEach(item => {
        inventory[item] = (inventory[item] || 0) - cost[item];
    });
}

function calculateTotalPowerConsumption(company) {
    let totalConsumption = 0;
    
    Object.keys(company.gameData.factories).forEach(factoryType => {
        const factory = company.gameData.factories[factoryType];
        const factoryTypeData = FACTORY_TYPES[factory.type];
        
        if (factory.productionTasks && factoryTypeData) {
            const activeTasks = factory.productionTasks.filter(task => !task.completed && !task.paused);
            const runningTasks = Math.min(activeTasks.length, factory.count);
            totalConsumption += runningTasks * (factoryTypeData.powerConsumption || 0);
        }
    });
    
    return totalConsumption;
}

function calculatePowerProduction(company) {
    let totalProduction = 0;
    
    Object.keys(company.gameData.factories).forEach(factoryType => {
        const factory = company.gameData.factories[factoryType];
        const factoryTypeData = FACTORY_TYPES[factory.type];
        
        if (factoryTypeData && factoryTypeData.produces && factoryTypeData.produces.includes('electricity')) {
            totalProduction += factory.count * 10; // 每个发电厂产10单位电
        }
    });
    
    return totalProduction;
}

function updatePowerStatus() {
    gameState.companies.forEach(company => {
        if (!company.gameData.factories) return;
        
        const powerProduction = calculatePowerProduction(company);
        const powerConsumption = calculateTotalPowerConsumption(company);
        
        Object.keys(company.gameData.factories).forEach(factoryType => {
            const factory = company.gameData.factories[factoryType];
            if (!factory.productionTasks) return;
            
            factory.productionTasks.forEach(task => {
                if (task.completed) return;
                
                if (powerConsumption > powerProduction) {
                    if (!task.paused) {
                        task.pause();
                    }
                } else {
                    if (task.paused) {
                        task.resume();
                    }
                }
            });
        });
    });
}

function updateLeaderboard() {
    const companies = Array.from(gameState.companies.values()).map(company => {
        const totalValue = calculateCompanyValue(company);
        
        // 更新玩家公司股价
        const oldPrice = company.sharePrice;
        company.sharePrice = Math.max(1, Math.floor(totalValue / 10000));
        company.lastChange = oldPrice > 0 ? (company.sharePrice - oldPrice) / oldPrice : 0;
        
        // 更新价格历史
        if (!company.priceHistory) company.priceHistory = [company.sharePrice];
        company.priceHistory.push(company.sharePrice);
        if (company.priceHistory.length > 50) {
            company.priceHistory = company.priceHistory.slice(-50);
        }
        
        return {
            id: company.id,
            name: company.name,
            isPlayer: true,
            value: totalValue,
            debt: company.gameData.debt || 0,
            level: company.gameData.level || 0,
            online: company.online,
            companyType: company.companyType,
            sharePrice: company.sharePrice,
            totalShares: company.totalShares,
            availableShares: company.availableShares,
            lastChange: company.lastChange
        };
    });
    
    const allCompanies = [...companies, ...gameState.aiCompanies.map(ai => ({
        ...ai,
        isPlayer: false,
        online: false,
        level: 5,
        debt: 0
    }))];
    
    io.emit('leaderboardUpdate', allCompanies.sort((a, b) => (b.value || 0) - (a.value || 0)));
}

function calculateCompanyValue(company) {
    let totalValue = company.gameData.inventory.money || 0;
    
    // 计算库存价值
    Object.keys(company.gameData.inventory).forEach(item => {
        if (item !== 'money') {
            const product = getProductByKey(item);
            if (product) {
                totalValue += (company.gameData.inventory[item] || 0) * product.basePrice;
            }
        }
    });
    
    // 计算工厂价值
    Object.keys(company.gameData.factories).forEach(factoryType => {
        const factory = company.gameData.factories[factoryType];
        const factoryData = FACTORY_TYPES[factoryType];
        if (factoryData && factoryData.cost.money) {
            totalValue += factory.count * factoryData.cost.money * 0.7;
        }
    });
    
    // 计算股票投资价值
    if (company.gameData.stockPortfolio) {
        Object.keys(company.gameData.stockPortfolio).forEach(companyId => {
            const shares = company.gameData.stockPortfolio[companyId];
            const targetCompany = gameState.aiCompanies.find(ai => ai.id === companyId) ||
                                Array.from(gameState.companies.values()).find(c => c.id === companyId);
            if (targetCompany) {
                totalValue += shares * targetCompany.sharePrice;
            }
        });
    }
    
    // 减去债务
    totalValue -= (company.gameData.debt || 0);
    
    return Math.max(0, totalValue);
}

function getLeaderboard() {
    try {
        const companies = Array.from(gameState.companies.values())
            .map(company => ({
                id: company.id,
                name: company.name,
                isPlayer: true,
                value: calculateCompanyValue(company),
                debt: company.gameData.debt || 0,
                level: company.gameData.level || 0,
                online: company.online,
                companyType: company.companyType,
                sharePrice: company.sharePrice,
                lastChange: company.lastChange || 0
            }));
        
        const allCompanies = [...companies, ...gameState.aiCompanies.map(ai => ({
            ...ai,
            isPlayer: false,
            online: false,
            level: 5,
            debt: 0
        }))];
        
        return allCompanies.sort((a, b) => (b.value || 0) - (a.value || 0));
    } catch (error) {
        console.error('getLeaderboard error:', error);
        return [];
    }
}

function getPlayerCompaniesForClient() {
    return Array.from(gameState.companies.values()).map(company => ({
        id: company.id,
        name: company.name,
        sharePrice: company.sharePrice,
        totalShares: company.totalShares,
        availableShares: company.availableShares,
        companyType: company.companyType,
        lastChange: company.lastChange || 0,
        priceHistory: company.priceHistory || [],
        online: company.online
    }));
}

function broadcastChatMessage(playerName, message, type = 'player') {
    const chatMessage = {
        player: playerName,
        message: message,
        timestamp: Date.now(),
        type: type
    };
    
    gameState.chatMessages.push(chatMessage);
    
    if (gameState.chatMessages.length > 100) {
        gameState.chatMessages = gameState.chatMessages.slice(-50);
    }
    
    io.emit('chatMessage', chatMessage);
}

function broadcastStockPrices() {
    const allCompanies = [...gameState.aiCompanies, ...getPlayerCompaniesForClient()];
    
    // 更新股价历史数据
    const now = new Date();
    const timeLabel = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    if (!gameState.stockPriceHistory.labels) {
        gameState.stockPriceHistory.labels = [];
        gameState.stockPriceHistory.datasets = {};
    }
    
    gameState.stockPriceHistory.labels.push(timeLabel);
    if (gameState.stockPriceHistory.labels.length > 50) {
        gameState.stockPriceHistory.labels = gameState.stockPriceHistory.labels.slice(-50);
    }
    
    allCompanies.slice(0, 6).forEach(company => {
        if (!gameState.stockPriceHistory.datasets[company.id]) {
            gameState.stockPriceHistory.datasets[company.id] = {
                label: company.name,
                data: []
            };
        }
        
        gameState.stockPriceHistory.datasets[company.id].data.push(company.sharePrice);
        if (gameState.stockPriceHistory.datasets[company.id].data.length > 50) {
            gameState.stockPriceHistory.datasets[company.id].data = gameState.stockPriceHistory.datasets[company.id].data.slice(-50);
        }
    });
    
    io.emit('stockPricesUpdate', {
        companies: allCompanies,
        history: gameState.stockPriceHistory
    });
}

// 处理生产任务
function processProductionTasks() {
    gameState.companies.forEach(company => {
        if (!company.gameData.factories) return;
        
        Object.keys(company.gameData.factories).forEach(factoryType => {
            const factory = company.gameData.factories[factoryType];
            
            if (!factory.productionTasks) return;
            
            factory.productionTasks.forEach(task => {
                if (task.isReady() && !task.completed) {
                    const product = getProductByKey(task.productId);
                    
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
                                experience: company.gameData.experience
                            }
                        });
                    }
                }
            });
            
            factory.productionTasks = factory.productionTasks.filter(task => !task.completed);
        });
    });
}

// 更新AI公司股价
function updateAIStockPrices() {
    gameState.aiCompanies.forEach(company => {
        const volatility = company.volatility;
        const change = (Math.random() - 0.5) * volatility * 2;
        const oldPrice = company.sharePrice;
        
        company.sharePrice = Math.max(1, Math.floor(company.sharePrice * (1 + change)));
        company.lastChange = (company.sharePrice - oldPrice) / oldPrice;
        
        // 更新价格历史
        if (!company.priceHistory) company.priceHistory = [company.sharePrice];
        company.priceHistory.push(company.sharePrice);
        if (company.priceHistory.length > 50) {
            company.priceHistory = company.priceHistory.slice(-50);
        }
        
        // 偶发冲击事件
        if (Math.random() < 0.01) {
            const shockMagnitude = (Math.random() - 0.5) * 0.3;
            company.sharePrice = Math.max(1, Math.floor(company.sharePrice * (1 + shockMagnitude)));
            
            const events = [
                '产品发布会成功',
                '获得大额投资',
                '技术突破',
                '市场份额增长',
                '监管政策变化',
                '竞争对手动态'
            ];
            
            if (!company.shockEvents) company.shockEvents = [];
            company.shockEvents.push({
                timestamp: Date.now(),
                magnitude: shockMagnitude,
                description: events[Math.floor(Math.random() * events.length)]
            });
            
            if (company.shockEvents.length > 5) {
                company.shockEvents = company.shockEvents.slice(-3);
            }
        }
    });
}

// 定时任务
setInterval(() => {
    processProductionTasks();
    updatePowerStatus();
}, 1000);

setInterval(() => {
    updateAIStockPrices();
    broadcastStockPrices();
}, 5000);

setInterval(() => {
    updateLeaderboard();
}, 10000);

const PORT = process.env.PORT || 3000;

server.listen(PORT, (error) => {
    if (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    } else {
        console.log(`🚀 黑心公司大亨 v2.3.1 服务器运行在端口 ${PORT}`);
        console.log(`🌐 访问地址: http://localhost:${PORT}`);
    }
});

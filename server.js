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
        electricity: { name: '电力', basePrice: 5, category: 'energy', productionTime: 1 },
        water: { name: '水', basePrice: 3, category: 'basic', productionTime: 2, recipe: { electricity: 1 } },
        iron_ore: { name: '铁矿石', basePrice: 20, category: 'raw', productionTime: 3 },
        oil_crude: { name: '原油', basePrice: 30, category: 'raw', productionTime: 4 },
        sand: { name: '沙子', basePrice: 10, category: 'raw', productionTime: 1 },
        wood_raw: { name: '原木', basePrice: 15, category: 'raw', productionTime: 2 },
        apple: { name: '苹果', basePrice: 8, category: 'agriculture', productionTime: 5 },
        wheat: { name: '小麦', basePrice: 12, category: 'agriculture', productionTime: 6 },
        cotton: { name: '棉花', basePrice: 18, category: 'agriculture', productionTime: 8 }
    },
    T1: {
        steel: { name: '钢铁', basePrice: 50, category: 'material', recipe: { iron_ore: 3, electricity: 2 }, productionTime: 10 },
        plastic: { name: '塑料', basePrice: 40, category: 'material', recipe: { oil_crude: 2, electricity: 1 }, productionTime: 8 },
        glass: { name: '玻璃', basePrice: 35, category: 'material', recipe: { sand: 4, electricity: 3 }, productionTime: 12 },
        lumber: { name: '木材', basePrice: 25, category: 'material', recipe: { wood_raw: 2, electricity: 1 }, productionTime: 6 },
        fuel: { name: '燃料', basePrice: 45, category: 'energy', recipe: { oil_crude: 3, electricity: 1 }, productionTime: 9 },
        apple_juice: { name: '苹果汁', basePrice: 20, category: 'beverage', recipe: { apple: 4, water: 2, electricity: 1 }, productionTime: 8 },
        flour: { name: '面粉', basePrice: 30, category: 'food', recipe: { wheat: 3, electricity: 2 }, productionTime: 10 },
        fabric: { name: '布料', basePrice: 60, category: 'textile', recipe: { cotton: 2, water: 3, electricity: 2 }, productionTime: 15 }
    },
    T2: {
        silicon_chip: { name: '硅芯片', basePrice: 200, category: 'tech', recipe: { sand: 5, electricity: 8, steel: 1 }, productionTime: 30 },
        engine: { name: '发动机', basePrice: 500, category: 'mechanical', recipe: { steel: 8, fuel: 3, electricity: 5 }, productionTime: 40 },
        electronic_board: { name: '电路板', basePrice: 150, category: 'tech', recipe: { silicon_chip: 2, plastic: 3, electricity: 4 }, productionTime: 25 },
        window: { name: '窗户', basePrice: 80, category: 'construction', recipe: { glass: 3, steel: 1, electricity: 2 }, productionTime: 18 },
        furniture: { name: '家具', basePrice: 120, category: 'home', recipe: { lumber: 5, fabric: 2, electricity: 3 }, productionTime: 35 },
        cola: { name: '可乐', basePrice: 15, category: 'beverage', recipe: { apple_juice: 1, water: 3, electricity: 1 }, productionTime: 12 },
        bread: { name: '面包', basePrice: 25, category: 'food', recipe: { flour: 2, water: 1, electricity: 2 }, productionTime: 15 },
        clothing: { name: '服装', basePrice: 100, category: 'consumer', recipe: { fabric: 3, plastic: 1, electricity: 2 }, productionTime: 28 }
    },
    T3: {
        smartphone: { name: '智能手机', basePrice: 800, category: 'consumer', recipe: { silicon_chip: 5, electronic_board: 3, plastic: 2, electricity: 10 }, productionTime: 60 },
        car: { name: '汽车', basePrice: 15000, category: 'consumer', recipe: { engine: 1, steel: 20, window: 6, electronic_board: 2, fuel: 5, electricity: 15 }, productionTime: 120 },
        computer: { name: '计算机', basePrice: 1200, category: 'tech', recipe: { silicon_chip: 8, electronic_board: 5, plastic: 4, electricity: 12 }, productionTime: 80 },
        house: { name: '房屋', basePrice: 50000, category: 'real_estate', recipe: { steel: 100, lumber: 50, window: 20, furniture: 10, electricity: 30 }, productionTime: 300 },
        restaurant_meal: { name: '餐厅餐点', basePrice: 35, category: 'food', recipe: { bread: 2, cola: 1, electricity: 3 }, productionTime: 20 },
        fashion_brand: { name: '时尚品牌', basePrice: 300, category: 'luxury', recipe: { clothing: 3, furniture: 1, electricity: 5 }, productionTime: 90 }
    },
    T4: {
        luxury_car: { name: '豪华汽车', basePrice: 80000, category: 'luxury', recipe: { car: 1, silicon_chip: 20, electronic_board: 10, electricity: 25 }, productionTime: 200 },
        premium_phone: { name: '高端手机', basePrice: 2500, category: 'luxury', recipe: { smartphone: 1, silicon_chip: 10, electricity: 15 }, productionTime: 120 },
        mansion: { name: '豪宅', basePrice: 500000, category: 'luxury', recipe: { house: 1, luxury_car: 1, fashion_brand: 5, electricity: 50 }, productionTime: 600 },
        private_jet: { name: '私人飞机', basePrice: 5000000, category: 'luxury', recipe: { engine: 20, electronic_board: 50, steel: 200, fuel: 100, electricity: 100 }, productionTime: 1200 }
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
        powerConsumption: 0
    },
    water_plant: {
        name: '水厂',
        emoji: '💧',
        cost: { money: 80000 },
        produces: ['water'],
        description: '净化处理水源',
        category: 'utility',
        efficiency: 1.0,
        powerConsumption: 2
    },
    iron_mine: {
        name: '铁矿',
        emoji: '⛏️',
        cost: { money: 100000 },
        produces: ['iron_ore'],
        description: '开采铁矿石',
        category: 'mining',
        efficiency: 1.0,
        powerConsumption: 1
    },
    oil_well: {
        name: '油井',
        emoji: '🛢️',
        cost: { money: 150000 },
        produces: ['oil_crude'],
        description: '开采原油',
        category: 'mining',
        efficiency: 1.0,
        powerConsumption: 2
    },
    sand_pit: {
        name: '沙坑',
        emoji: '🏖️',
        cost: { money: 30000 },
        produces: ['sand'],
        description: '采集沙子',
        category: 'mining',
        efficiency: 1.0,
        powerConsumption: 0
    },
    lumber_mill: {
        name: '伐木场',
        emoji: '🌲',
        cost: { money: 60000 },
        produces: ['wood_raw'],
        description: '砍伐原木',
        category: 'forestry',
        efficiency: 1.0,
        powerConsumption: 1
    },
    apple_farm: {
        name: '苹果农场',
        emoji: '🍎',
        cost: { money: 40000 },
        produces: ['apple'],
        description: '种植苹果',
        category: 'agriculture',
        efficiency: 1.0,
        powerConsumption: 1
    },
    wheat_farm: {
        name: '小麦农场',
        emoji: '🌾',
        cost: { money: 45000 },
        produces: ['wheat'],
        description: '种植小麦',
        category: 'agriculture',
        efficiency: 1.0,
        powerConsumption: 1
    },
    cotton_farm: {
        name: '棉花农场',
        emoji: '🌸',
        cost: { money: 50000 },
        produces: ['cotton'],
        description: '种植棉花',
        category: 'agriculture',
        efficiency: 1.0,
        powerConsumption: 1
    },
    steel_mill: {
        name: '钢铁厂',
        emoji: '🏭',
        cost: { money: 200000, iron_ore: 50 },
        produces: ['steel'],
        description: '冶炼钢铁',
        category: 'processing',
        efficiency: 1.0,
        powerConsumption: 5
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
        powerConsumption: 6
    },
    sawmill: {
        name: '锯木厂',
        emoji: '🪚',
        cost: { money: 120000, wood_raw: 50 },
        produces: ['lumber'],
        description: '加工木材',
        category: 'processing',
        efficiency: 1.0,
        powerConsumption: 3
    },
    juice_factory: {
        name: '果汁厂',
        emoji: '🧃',
        cost: { money: 90000, apple: 100 },
        produces: ['apple_juice'],
        description: '生产果汁',
        category: 'food_processing',
        efficiency: 1.0,
        powerConsumption: 4
    },
    flour_mill: {
        name: '面粉厂',
        emoji: '🌾',
        cost: { money: 100000, wheat: 80 },
        produces: ['flour'],
        description: '磨制面粉',
        category: 'food_processing',
        efficiency: 1.0,
        powerConsumption: 4
    },
    textile_mill: {
        name: '纺织厂',
        emoji: '🧵',
        cost: { money: 150000, cotton: 60 },
        produces: ['fabric'],
        description: '纺织布料',
        category: 'textile',
        efficiency: 1.0,
        powerConsumption: 5
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
        powerConsumption: 6
    },
    beverage_factory: {
        name: '饮料厂',
        emoji: '🥤',
        cost: { money: 120000, apple_juice: 50 },
        produces: ['cola'],
        description: '生产饮料',
        category: 'beverage',
        efficiency: 1.0,
        powerConsumption: 5
    },
    bakery: {
        name: '面包厂',
        emoji: '🍞',
        cost: { money: 80000, flour: 40 },
        produces: ['bread'],
        description: '烘焙面包',
        category: 'food',
        efficiency: 1.0,
        powerConsumption: 4
    },
    garment_factory: {
        name: '服装厂',
        emoji: '👕',
        cost: { money: 160000, fabric: 30, plastic: 10 },
        produces: ['clothing'],
        description: '制造服装',
        category: 'apparel',
        efficiency: 1.0,
        powerConsumption: 6
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

// AI公司定义
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
            shockEvents: []
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
            shockEvents: []
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
            shockEvents: []
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
            shockEvents: []
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
            shockEvents: []
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
    gameVersion: '2.3.1'
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
        
        const product = this.getProductInfo();
        this.totalTime = product.productionTime * 1000 * quantity;
        this.completionTime = this.startTime + this.totalTime;
        this.progress = 0;
        this.pausedTime = 0;
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
        if (this.paused) return false;
        return Date.now() >= this.completionTime;
    }
    
    getProgress() {
        if (this.paused) return this.progress;
        const elapsed = Date.now() - this.startTime - this.pausedTime;
        const progress = Math.min(elapsed / this.totalTime, 1);
        this.progress = progress;
        return progress;
    }
    
    getRemainingTime() {
        if (this.paused) return this.totalTime - (this.progress * this.totalTime);
        return Math.max(0, this.completionTime - Date.now());
    }
    
    pause() {
        if (!this.paused) {
            this.paused = true;
            this.pauseStartTime = Date.now();
        }
    }
    
    resume() {
        if (this.paused) {
            this.pausedTime += Date.now() - this.pauseStartTime;
            this.completionTime = Date.now() + this.getRemainingTime();
            this.paused = false;
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
            
            const companyData = {
                id: socket.id,
                name: companyName,
                playerName: playerName,
                companyType: companyType || 'tech',
                gameData: createNewCompany(companyType),
                online: true,
                lastSeen: Date.now(),
                socket: socket
            };
            
            gameState.companies.set(socket.id, companyData);
            gameState.playerNames.set(companyName, socket.id);
            
            socket.emit('gameState', {
                globalMarkets: gameState.globalMarkets,
                leaderboard: getLeaderboard(),
                chatMessages: gameState.chatMessages.slice(-50),
                globalEvent: gameState.globalEvent,
                productTiers: PRODUCT_TIERS,
                factoryTypes: FACTORY_TYPES,
                marketTiers: MARKET_TIERS,
                techTree: TECH_TREE,
                aiCompanies: gameState.aiCompanies
            });
            
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
            
        } catch (error) {
            console.error('buildFactory error:', error);
        }
    });
    
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
    
    socket.on('disconnect', () => {
        try {
            const company = gameState.companies.get(socket.id);
            if (company) {
                company.online = false;
                company.lastSeen = Date.now();
                console.log(`👋 公司 ${company.name} 断开连接`);
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

function getLeaderboard() {
    try {
        const companies = Array.from(gameState.companies.values())
            .map(company => ({
                id: company.id,
                name: company.name,
                isPlayer: true,
                value: company.gameData.inventory.money || 0,
                level: 0,
                online: company.online,
                companyType: company.companyType
            }));
        
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

setInterval(processProductionTasks, 1000);

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

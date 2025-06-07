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

// 重新设计产品定义系统 - 更复杂的依赖关系
const PRODUCT_TIERS = {
    // 基础资源（无需其他输入）
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
    
    // 初级加工
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
    
    // 中级制造
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
    
    // 高级产品
    T3: {
        smartphone: { name: '智能手机', basePrice: 800, category: 'consumer', recipe: { silicon_chip: 5, electronic_board: 3, plastic: 2, electricity: 10 }, productionTime: 60 },
        car: { name: '汽车', basePrice: 15000, category: 'consumer', recipe: { engine: 1, steel: 20, window: 6, electronic_board: 2, fuel: 5, electricity: 15 }, productionTime: 120 },
        computer: { name: '计算机', basePrice: 1200, category: 'tech', recipe: { silicon_chip: 8, electronic_board: 5, plastic: 4, electricity: 12 }, productionTime: 80 },
        house: { name: '房屋', basePrice: 50000, category: 'real_estate', recipe: { steel: 100, lumber: 50, window: 20, furniture: 10, electricity: 30 }, productionTime: 300 },
        restaurant_meal: { name: '餐厅餐点', basePrice: 35, category: 'food', recipe: { bread: 2, cola: 1, electricity: 3 }, productionTime: 20 },
        fashion_brand: { name: '时尚品牌', basePrice: 300, category: 'luxury', recipe: { clothing: 3, furniture: 1, electricity: 5 }, productionTime: 90 }
    },
    
    // 奢侈品
    T4: {
        luxury_car: { name: '豪华汽车', basePrice: 80000, category: 'luxury', recipe: { car: 1, silicon_chip: 20, electronic_board: 10, electricity: 25 }, productionTime: 200 },
        premium_phone: { name: '高端手机', basePrice: 2500, category: 'luxury', recipe: { smartphone: 1, silicon_chip: 10, electricity: 15 }, productionTime: 120 },
        mansion: { name: '豪宅', basePrice: 500000, category: 'luxury', recipe: { house: 1, luxury_car: 1, fashion_brand: 5, electricity: 50 }, productionTime: 600 },
        private_jet: { name: '私人飞机', basePrice: 5000000, category: 'luxury', recipe: { engine: 20, electronic_board: 50, steel: 200, fuel: 100, electricity: 100 }, productionTime: 1200 }
    }
};

// 重新设计工厂系统 - 拆分更细分
const FACTORY_TYPES = {
    // 基础工厂
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
    
    // 采矿农业
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
    
    // 初级加工厂
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
    
    // 中级制造
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
    
    // 高级组装
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
    
    // 奢侈品工厂
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

// 10个AI公司 - 更加跌宕起伏的股价
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
            volatility: 0.25, // 增大波动性
            underAttack: false,
            specialty: 'electronics',
            stockHistory: [],
            sharePrice: 180,
            totalShares: 1000000,
            tradingVolume: 0,
            momentum: 0, // 动量因子
            shockEvents: [] // 冲击事件
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
            volatility: 0.35, // 汽车股波动大
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
        },
        {
            id: 'ai_meta_social',
            name: '元宇宙社交',
            value: 85000000,
            trend: -1,
            sector: '社交媒体',
            companyType: 'tech',
            volatility: 0.30,
            underAttack: false,
            specialty: 'social_media',
            stockHistory: [],
            sharePrice: 85,
            totalShares: 1000000,
            tradingVolume: 0,
            momentum: 0,
            shockEvents: []
        },
        {
            id: 'ai_nike_sports',
            name: '耐克体育',
            value: 75000000,
            trend: 1,
            sector: '服装',
            companyType: 'retail',
            volatility: 0.22,
            underAttack: false,
            specialty: 'sportswear',
            stockHistory: [],
            sharePrice: 75,
            totalShares: 1000000,
            tradingVolume: 0,
            momentum: 0,
            shockEvents: []
        },
        {
            id: 'ai_coca_cola',
            name: '可口可乐',
            value: 68000000,
            trend: 0,
            sector: '饮料',
            companyType: 'food',
            volatility: 0.12, // 消费品股票相对稳定
            underAttack: false,
            specialty: 'beverages',
            stockHistory: [],
            sharePrice: 68,
            totalShares: 1000000,
            tradingVolume: 0,
            momentum: 0,
            shockEvents: []
        },
        {
            id: 'ai_loreal_beauty',
            name: '欧莱雅美妆',
            value: 55000000,
            trend: 1,
            sector: '美妆',
            companyType: 'beauty',
            volatility: 0.28,
            underAttack: false,
            specialty: 'cosmetics',
            stockHistory: [],
            sharePrice: 55,
            totalShares: 1000000,
            tradingVolume: 0,
            momentum: 0,
            shockEvents: []
        },
        {
            id: 'ai_mcdonalds',
            name: '麦当劳餐饮',
            value: 45000000,
            trend: 0,
            sector: '快餐',
            companyType: 'food',
            volatility: 0.14,
            underAttack: false,
            specialty: 'fast_food',
            stockHistory: [],
            sharePrice: 45,
            totalShares: 1000000,
            tradingVolume: 0,
            momentum: 0,
            shockEvents: []
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
    eventDuration: 10 * 60 * 1000,
    gameVersion: '2.3.0'
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
        this.paused = false; // 电力不足时暂停
        
        const product = this.getProductInfo();
        this.totalTime = product.productionTime * 1000 * quantity;
        this.completionTime = this.startTime + this.totalTime;
        this.progress = 0;
        this.pausedTime = 0; // 暂停的总时间
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

console.log('🏢 黑心公司大亨 v2.3 服务器启动中...');

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
                    message: '游戏已更新到v2.3，全新生产链系统+借贷杠杆！所有进度已重置。'
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
                addChatMessage('系统', `${companyName} 进入了全新的生产链世界！`);
                addNewsEvent(`🏢 ${companyName} 开始了复杂生产链之旅`);
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
            const { factoryType, quantity = 1 } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company || !FACTORY_TYPES[factoryType]) {
                return;
            }
            
            const factory = FACTORY_TYPES[factoryType];
            const totalCost = {};
            
            // 计算总成本
            Object.keys(factory.cost).forEach(item => {
                totalCost[item] = factory.cost[item] * quantity;
            });
            
            if (!canAfford(company.gameData.inventory, totalCost)) {
                socket.emit('error', { message: '资源不足，无法建造工厂' });
                return;
            }
            
            payCost(company.gameData.inventory, totalCost);
            
            // 合并同类工厂
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
                message: `成功建造 ${quantity} 个 ${factory.name}！总数: ${company.gameData.factories[factoryType].count}`,
                playerData: {
                    inventory: company.gameData.inventory,
                    factories: company.gameData.factories
                }
            });
            
            addChatMessage('工业快讯', `${company.name} 建造了 ${quantity} 个 ${factory.name}`);
            
        } catch (error) {
            console.error('buildFactory error:', error);
        }
    });
    
    // 批量生产操作
    socket.on('batchProduction', (data) => {
        try {
            const { operations } = data; // [{ factoryType, productId, quantity }, ...]
            const company = gameState.companies.get(socket.id);
            
            if (!company || !Array.isArray(operations)) {
                return;
            }
            
            let successCount = 0;
            let errorMessages = [];
            
            operations.forEach(op => {
                const { factoryType, productId, quantity } = op;
                
                if (!company.gameData.factories[factoryType]) {
                    errorMessages.push(`没有 ${FACTORY_TYPES[factoryType]?.name} 工厂`);
                    return;
                }
                
                const factory = company.gameData.factories[factoryType];
                const factoryTypeData = FACTORY_TYPES[factory.type];
                
                if (!factoryTypeData.produces.includes(productId)) {
                    errorMessages.push(`${factoryTypeData.name} 无法生产 ${getProductByKey(productId)?.name}`);
                    return;
                }
                
                // 检查原料
                const product = getProductByKey(productId);
                if (!product) {
                    errorMessages.push(`未知产品: ${productId}`);
                    return;
                }
                
                if (product.recipe) {
                    const totalRecipe = {};
                    Object.keys(product.recipe).forEach(material => {
                        totalRecipe[material] = product.recipe[material] * quantity;
                    });
                    
                    if (!canAfford(company.gameData.inventory, totalRecipe)) {
                        errorMessages.push(`${product.name} 原料不足`);
                        return;
                    }
                    
                    payCost(company.gameData.inventory, totalRecipe);
                }
                
                const task = new ProductionTask(factoryType, productId, quantity, socket.id);
                
                if (!factory.productionTasks) factory.productionTasks = [];
                factory.productionTasks.push(task);
                
                successCount++;
            });
            
            socket.emit('batchProductionResult', {
                successCount: successCount,
                totalCount: operations.length,
                errors: errorMessages,
                message: `批量操作完成：${successCount}/${operations.length} 个任务成功启动`,
                playerData: {
                    inventory: company.gameData.inventory,
                    factories: company.gameData.factories
                }
            });
            
            if (successCount > 0) {
                addChatMessage('生产快讯', `${company.name} 启动了 ${successCount} 个批量生产任务`);
            }
            
        } catch (error) {
            console.error('batchProduction error:', error);
        }
    });
    
    // 开始生产
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
    
    // 借贷系统
    socket.on('requestLoan', (data) => {
        try {
            const { amount, leverage = 1 } = data; // leverage: 1-10倍杠杆
            const company = gameState.companies.get(socket.id);
            
            if (!company) return;
            
            if (leverage < 1 || leverage > 10) {
                socket.emit('error', { message: '杠杆倍数必须在1-10倍之间' });
                return;
            }
            
            const maxLoan = calculateCompanyValue(company.gameData) * leverage;
            const currentDebt = company.gameData.debt || 0;
            
            if (currentDebt + amount > maxLoan) {
                socket.emit('error', { message: `超出最大借贷额度 ${formatNumber(maxLoan)}` });
                return;
            }
            
            // 计算利率（基础利率 + 杠杆率）
            const baseRate = 0.05; // 5% 基础年利率
            const leverageRate = (leverage - 1) * 0.02; // 每增加1倍杠杆增加2%利率
            const interestRate = baseRate + leverageRate;
            
            if (!company.gameData.loans) company.gameData.loans = [];
            
            const loan = {
                id: 'loan_' + Date.now(),
                amount: amount,
                interestRate: interestRate,
                startTime: Date.now(),
                leverage: leverage,
                monthlyPayment: amount * (interestRate / 12 + 0.01) // 月还款额
            };
            
            company.gameData.loans.push(loan);
            company.gameData.debt = (company.gameData.debt || 0) + amount;
            company.gameData.inventory.money += amount;
            
            socket.emit('loanApproved', {
                loan: loan,
                message: `获得贷款 ${formatNumber(amount)} 💰，${leverage}倍杠杆，年利率 ${(interestRate * 100).toFixed(2)}%`,
                playerData: {
                    money: company.gameData.inventory.money,
                    debt: company.gameData.debt,
                    loans: company.gameData.loans
                }
            });
            
            addChatMessage('金融快讯', `${company.name} 获得 ${leverage}倍杠杆贷款 ${formatNumber(amount)} 💰`);
            
        } catch (error) {
            console.error('requestLoan error:', error);
        }
    });
    
    // 还贷
    socket.on('repayLoan', (data) => {
        try {
            const { loanId, amount } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company || !company.gameData.loans) return;
            
            const loanIndex = company.gameData.loans.findIndex(loan => loan.id === loanId);
            if (loanIndex === -1) {
                socket.emit('error', { message: '未找到该贷款' });
                return;
            }
            
            if (company.gameData.inventory.money < amount) {
                socket.emit('error', { message: '资金不足' });
                return;
            }
            
            const loan = company.gameData.loans[loanIndex];
            company.gameData.inventory.money -= amount;
            loan.amount -= amount;
            company.gameData.debt -= amount;
            
            if (loan.amount <= 0) {
                company.gameData.loans.splice(loanIndex, 1);
            }
            
            socket.emit('loanRepaid', {
                loanId: loanId,
                paidAmount: amount,
                remainingAmount: Math.max(0, loan.amount),
                message: `成功还款 ${formatNumber(amount)} 💰`,
                playerData: {
                    money: company.gameData.inventory.money,
                    debt: company.gameData.debt,
                    loans: company.gameData.loans
                }
            });
            
        } catch (error) {
            console.error('repayLoan error:', error);
        }
    });
    
    // 金融市场交易 - 支持杠杆
    socket.on('stockTrade', (data) => {
        try {
            const { action, companyId, shares, multiplier, leverage = 1 } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company) return;
            
            // 找到目标公司
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
            const leveragedCost = totalCost / leverage; // 杠杆交易只需付部分资金
            const tradeFee = totalCost * 0.01;
            
            if (!company.gameData.stockPortfolio) {
                company.gameData.stockPortfolio = {};
            }
            
            if (action === 'buy') {
                if (company.gameData.inventory.money >= leveragedCost + tradeFee) {
                    company.gameData.inventory.money -= leveragedCost + tradeFee;
                    
                    // 记录杠杆持仓
                    if (!company.gameData.leveragedPositions) {
                        company.gameData.leveragedPositions = {};
                    }
                    
                    if (leverage > 1) {
                        if (!company.gameData.leveragedPositions[companyId]) {
                            company.gameData.leveragedPositions[companyId] = [];
                        }
                        company.gameData.leveragedPositions[companyId].push({
                            shares: tradeShares,
                            entryPrice: targetCompany.sharePrice,
                            leverage: leverage,
                            timestamp: Date.now(),
                            borrowedAmount: totalCost - leveragedCost
                        });
                    } else {
                        company.gameData.stockPortfolio[companyId] = (company.gameData.stockPortfolio[companyId] || 0) + tradeShares;
                    }
                    
                    // 更新目标公司股价
                    const priceImpact = Math.min(0.05, tradeShares / targetCompany.totalShares * 10);
                    targetCompany.sharePrice = Math.floor(targetCompany.sharePrice * (1 + priceImpact));
                    targetCompany.tradingVolume += tradeShares;
                    
                    socket.emit('stockTradeSuccess', {
                        action, companyId, shares: tradeShares, leverage,
                        message: `${leverage > 1 ? leverage + '倍杠杆' : ''}买入 ${targetCompany.name} ${tradeShares} 股`,
                        playerData: {
                            money: company.gameData.inventory.money,
                            stockPortfolio: company.gameData.stockPortfolio,
                            leveragedPositions: company.gameData.leveragedPositions
                        }
                    });
                    
                    // 检查持股节点事件
                    checkShareholdingEvent(company, targetCompany, tradeShares, 'buy');
                    
                    addChatMessage('金融快讯', `${company.name} ${leverage > 1 ? leverage + '倍杠杆' : ''}买入 ${targetCompany.name} ${formatNumber(tradeShares)} 股`);
                }
            }
            else if (action === 'sell') {
                // 卖出逻辑（包括杠杆平仓）
                // ... 这里简化处理
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
    
    // 其他现有的socket处理保持不变...
    // 市场交易、科技研发、聊天等
    
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
                
                addChatMessage('系统', `${company.name} 暂时离开了商业世界`);
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
            money: 1000000, // 增加初始资金
            // 给一些初始资源
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
        shortPositions: {},
        leveragedPositions: {},
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

function calculateCompanyLevel(gameData) {
    const experience = gameData.experience || 0;
    return Math.floor(experience / 1000);
}

function calculateCompanyValue(gameData) {
    let value = gameData.inventory.money || 0;
    
    // 减去债务
    value -= (gameData.debt || 0);
    
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
    
    // 杠杆持仓价值（减去借贷部分）
    if (gameData.leveragedPositions) {
        Object.keys(gameData.leveragedPositions).forEach(companyId => {
            const positions = gameData.leveragedPositions[companyId] || [];
            positions.forEach(position => {
                const aiCompany = gameState.aiCompanies.find(ai => ai.id === companyId);
                if (aiCompany) {
                    const currentValue = position.shares * aiCompany.sharePrice;
                    value += currentValue - position.borrowedAmount;
                }
            });
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
        case 'power_efficiency':
            Object.keys(gameData.factories).forEach(factoryType => {
                gameData.factories[factoryType].powerConsumption *= 0.8;
            });
            break;
        case 'automation_basic':
            Object.keys(gameData.factories).forEach(factoryType => {
                gameData.factories[factoryType].efficiency *= 1.25;
            });
            break;
        case 'advanced_automation':
            Object.keys(gameData.factories).forEach(factoryType => {
                gameData.factories[factoryType].efficiency *= 1.5;
            });
            break;
        case 'ai_optimization':
            Object.keys(gameData.factories).forEach(factoryType => {
                gameData.factories[factoryType].efficiency *= 2.0;
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
                const dividend = targetCompany.sharePrice * (company.gameData.stockPortfolio[targetCompany.id] || 0) * 0.02;
                company.gameData.inventory.money += dividend;
                company.socket.emit('shareholderEvent', {
                    type: 'dividend',
                    message: `作为 ${targetCompany.name} 的重要股东，获得分红 ${formatNumber(dividend)} 💰`,
                    amount: dividend
                });
                break;
                
            case 'large_shareholder':
                targetCompany.sharePrice = Math.floor(targetCompany.sharePrice * 1.05);
                addNewsEvent(`📊 ${company.name} 的投资推高了 ${targetCompany.name} 股价`);
                break;
                
            case 'controlling_interest':
                const bonus = targetCompany.value * 0.01;
                company.gameData.inventory.money += bonus;
                company.socket.emit('shareholderEvent', {
                    type: 'control_bonus',
                    message: `获得 ${targetCompany.name} 控股权，获得管理奖金 ${formatNumber(bonus)} 💰`,
                    amount: bonus
                });
                break;
                
            case 'mass_sell_off':
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
            .filter(company => company && company.gameData && !company.gameData.bankrupt)
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
                    stockHistory: company.stockHistory || [],
                    debt: company.gameData.debt || 0
                };
            });
        
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

// 检查电力供应和生产依赖
function checkPowerSupply(company) {
    const gameData = company.gameData;
    let totalPowerProduction = 0;
    let totalPowerConsumption = 0;
    
    // 计算总发电量
    Object.keys(gameData.factories).forEach(factoryType => {
        const factory = gameData.factories[factoryType];
        const factoryTypeData = FACTORY_TYPES[factory.type];
        
        if (factoryTypeData.produces.includes('electricity')) {
            totalPowerProduction += factory.count * factory.efficiency * 10; // 每个发电厂每秒产10单位电
        }
    });
    
    // 计算总耗电量
    Object.keys(gameData.factories).forEach(factoryType => {
        const factory = gameData.factories[factoryType];
        const factoryTypeData = FACTORY_TYPES[factory.type];
        
        if (factory.productionTasks && factory.productionTasks.length > 0) {
            const activeTasks = factory.productionTasks.filter(task => !task.completed);
            const concurrentTasks = Math.min(activeTasks.length, factory.count);
            totalPowerConsumption += concurrentTasks * factoryTypeData.powerConsumption;
        }
    });
    
    // 电力不足时暂停生产
    if (totalPowerConsumption > totalPowerProduction) {
        Object.keys(gameData.factories).forEach(factoryType => {
            const factory = gameData.factories[factoryType];
            if (factory.productionTasks) {
                factory.productionTasks.forEach(task => {
                    if (!task.completed && !task.paused) {
                        task.pause();
                    }
                });
            }
        });
        
        if (company.socket) {
            company.socket.emit('powerShortage', {
                message: '电力不足！生产已暂停，请建造更多发电厂',
                powerProduction: totalPowerProduction,
                powerConsumption: totalPowerConsumption
            });
        }
    } else {
        // 电力充足时恢复生产
        Object.keys(gameData.factories).forEach(factoryType => {
            const factory = gameData.factories[factoryType];
            if (factory.productionTasks) {
                factory.productionTasks.forEach(task => {
                    if (!task.completed && task.paused) {
                        task.resume();
                    }
                });
            }
        });
    }
}

// 检查破产
function checkBankruptcy() {
    gameState.companies.forEach(company => {
        const value = calculateCompanyValue(company.gameData);
        const debt = company.gameData.debt || 0;
        
        // 资不抵债时破产
        if (value < 0 || (debt > 0 && value < debt * 0.1)) {
            company.gameData.bankrupt = true;
            
            if (company.socket) {
                company.socket.emit('bankruptcy', {
                    message: '公司已破产！所有资产将被清算，请重新开始游戏。',
                    finalValue: value,
                    totalDebt: debt
                });
            }
            
            addChatMessage('破产公告', `${company.name} 因资不抵债宣布破产`);
            addNewsEvent(`💥 ${company.name} 宣布破产，总负债 ${formatNumber(debt)} 💰`);
        }
    });
}

// 处理贷款利息
function processLoanInterests() {
    gameState.companies.forEach(company => {
        if (!company.gameData.loans || company.gameData.loans.length === 0) return;
        
        const now = Date.now();
        company.gameData.loans.forEach(loan => {
            const monthsElapsed = (now - loan.startTime) / (30 * 24 * 60 * 60 * 1000);
            const interestOwed = loan.monthlyPayment * Math.floor(monthsElapsed);
            
            if (interestOwed > 0 && company.gameData.inventory.money >= interestOwed) {
                company.gameData.inventory.money -= interestOwed;
                loan.startTime = now; // 重置计息时间
                
                if (company.socket) {
                    company.socket.emit('interestPaid', {
                        loanId: loan.id,
                        amount: interestOwed,
                        message: `自动支付贷款利息 ${formatNumber(interestOwed)} 💰`
                    });
                }
            } else if (interestOwed > 0) {
                // 无法支付利息，增加债务
                company.gameData.debt += interestOwed;
                loan.amount += interestOwed;
                loan.startTime = now;
                
                if (company.socket) {
                    company.socket.emit('interestDefault', {
                        loanId: loan.id,
                        amount: interestOwed,
                        message: `无法支付贷款利息，债务增加 ${formatNumber(interestOwed)} 💰`
                    });
                }
            }
        });
    });
}

// 处理生产任务完成 - 考虑电力和依赖关系
function processProductionTasks() {
    gameState.companies.forEach(company => {
        if (!company.gameData.factories) return;
        
        // 检查电力供应
        checkPowerSupply(company);
        
        Object.keys(company.gameData.factories).forEach(factoryType => {
            const factory = company.gameData.factories[factoryType];
            
            if (!factory.productionTasks) return;
            
            // 并行处理多个任务（基于工厂数量）
            const maxConcurrentTasks = Math.min(factory.count, 10);
            const activeTasks = factory.productionTasks.filter(task => !task.completed && !task.paused).slice(0, maxConcurrentTasks);
            
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
                            remainingTime: task.getRemainingTime(),
                            paused: task.paused
                        });
                    }
                }
            });
            
            // 清理已完成的任务
            factory.productionTasks = factory.productionTasks.filter(task => !task.completed);
        });
    });
}

// 更新AI公司股价 - 更加跌宕起伏
function updateAIStockPrices() {
    gameState.aiCompanies.forEach(company => {
        // 基础波动
        const baseVolatility = company.volatility;
        let change = (Math.random() - 0.5) * baseVolatility * 2;
        
        // 动量效应（趋势延续）
        company.momentum = (company.momentum || 0) * 0.7 + change * 0.3;
        change += company.momentum * 0.5;
        
        // 随机冲击事件（10%概率）
        if (Math.random() < 0.1) {
            const shockMagnitude = (Math.random() - 0.5) * 0.3; // ±15%
            change += shockMagnitude;
            
            company.shockEvents.push({
                timestamp: Date.now(),
                magnitude: shockMagnitude,
                description: shockMagnitude > 0 ? '利好消息' : '利空消息'
            });
            
            // 只保留最近的冲击事件
            if (company.shockEvents.length > 5) {
                company.shockEvents.shift();
            }
            
            const direction = shockMagnitude > 0 ? '暴涨' : '暴跌';
            addNewsEvent(`📊 ${company.name} ${direction}${Math.abs(shockMagnitude * 100).toFixed(1)}%！${shockMagnitude > 0 ? '📈' : '📉'}`);
        }
        
        // 市场情绪传染（相关行业互相影响）
        const sameTypeCompanies = gameState.aiCompanies.filter(c => 
            c.companyType === company.companyType && c.id !== company.id);
        
        if (sameTypeCompanies.length > 0) {
            const avgChange = sameTypeCompanies.reduce((sum, c) => sum + (c.lastChange || 0), 0) / sameTypeCompanies.length;
            change += avgChange * 0.2; // 20%的传染效应
        }
        
        // 应用价格变化
        const oldPrice = company.sharePrice;
        company.sharePrice = Math.max(1, Math.floor(company.sharePrice * (1 + change)));
        company.value = company.sharePrice * company.totalShares;
        company.trend = change > 0.02 ? 1 : change < -0.02 ? -1 : 0;
        company.lastChange = change;
        
        // 记录股价历史
        company.stockHistory.push({
            time: Date.now(),
            price: company.sharePrice,
            change: change,
            volume: company.tradingVolume || 0,
            events: company.shockEvents.slice(-1) // 最近的事件
        });
        
        if (company.stockHistory.length > 200) {
            company.stockHistory.shift();
        }
        
        // 重置交易量
        company.tradingVolume = 0;
    });
}

// 定时器设置
setInterval(processProductionTasks, 1000); // 每1秒处理生产
setInterval(updateAIStockPrices, 5000); // 每5秒更新股价（更频繁）
setInterval(processLoanInterests, 60000); // 每分钟处理贷款利息
setInterval(checkBankruptcy, 30000); // 每30秒检查破产

// 更新排行榜
setInterval(() => {
    try {
        io.emit('leaderboardUpdate', getLeaderboard());
        io.emit('stockUpdate', gameState.aiCompanies);
    } catch (error) {
        console.error('Update error:', error);
    }
}, 10000);

const PORT = process.env.PORT || 3000;

server.listen(PORT, (error) => {
    if (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    } else {
        console.log(`🚀 黑心公司大亨 v2.3 服务器运行在端口 ${PORT}`);
        console.log(`🌐 访问地址: http://localhost:${PORT}`);
        console.log(`💼 等待CEO们体验全新的生产链+借贷系统...`);
        console.log(`📊 新特性: 复杂生产链 | 借贷杠杆 | 电力依赖 | 破产机制 | 批量操作`);
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

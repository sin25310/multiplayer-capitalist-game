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

// 产品定义系统
const PRODUCT_TIERS = {
    T1: { // 原材料
        steel: { name: '钢铁', basePrice: 100, category: 'metal', productionTime: 5 },
        oil: { name: '石油', basePrice: 80, category: 'energy', productionTime: 3 },
        silicon: { name: '硅', basePrice: 150, category: 'tech', productionTime: 8 },
        wood: { name: '木材', basePrice: 60, category: 'natural', productionTime: 2 },
        rare_earth: { name: '稀土', basePrice: 300, category: 'tech', productionTime: 15 }
    },
    T2: { // 初级产品
        plastic: { name: '塑料', basePrice: 200, category: 'material', recipe: { oil: 2 }, productionTime: 10 },
        chips: { name: '芯片', basePrice: 800, category: 'tech', recipe: { silicon: 1, rare_earth: 1 }, productionTime: 30 },
        steel_bar: { name: '钢材', basePrice: 250, category: 'material', recipe: { steel: 3 }, productionTime: 15 },
        fuel: { name: '燃料', basePrice: 180, category: 'energy', recipe: { oil: 2 }, productionTime: 8 },
        paper: { name: '纸张', basePrice: 120, category: 'material', recipe: { wood: 2 }, productionTime: 5 }
    },
    T3: { // 中级产品
        components: { name: '电子组件', basePrice: 1500, category: 'tech', recipe: { chips: 2, plastic: 1 }, productionTime: 60 },
        machinery: { name: '机械零件', basePrice: 1200, category: 'industrial', recipe: { steel_bar: 3, plastic: 1 }, productionTime: 45 },
        software: { name: '软件', basePrice: 2000, category: 'tech', recipe: { chips: 1 }, productionTime: 90 },
        textiles: { name: '纺织品', basePrice: 800, category: 'consumer', recipe: { plastic: 2, paper: 1 }, productionTime: 30 }
    },
    T4: { // 高级产品
        smartphone: { name: '智能手机', basePrice: 8000, category: 'consumer', recipe: { components: 3, software: 1 }, productionTime: 180 },
        car: { name: '汽车', basePrice: 25000, category: 'consumer', recipe: { machinery: 8, components: 2, fuel: 5 }, productionTime: 300 },
        computer: { name: '计算机', basePrice: 12000, category: 'tech', recipe: { components: 5, software: 2 }, productionTime: 240 },
        clothing: { name: '服装', basePrice: 500, category: 'consumer', recipe: { textiles: 2 }, productionTime: 45 }
    },
    T5: { // 奢侈品
        luxury_car: { name: '豪华汽车', basePrice: 100000, category: 'luxury', recipe: { car: 1, components: 5 }, productionTime: 600 },
        premium_phone: { name: '限量手机', basePrice: 20000, category: 'luxury', recipe: { smartphone: 1, rare_earth: 2 }, productionTime: 360 },
        designer_clothes: { name: '设计师服装', basePrice: 5000, category: 'luxury', recipe: { clothing: 3, rare_earth: 1 }, productionTime: 180 }
    }
};

// 工厂类型定义
const FACTORY_TYPES = {
    mining: {
        name: '采矿厂',
        emoji: '⛏️',
        unlockLevel: 0,
        cost: { money: 100000 },
        produces: ['steel', 'oil', 'silicon', 'wood', 'rare_earth'],
        description: '开采原材料',
        baseEfficiency: 1.0
    },
    chemical: {
        name: '化工厂',
        emoji: '🧪',
        unlockLevel: 1,
        cost: { money: 300000, steel: 50 },
        produces: ['plastic', 'fuel'],
        description: '生产化工产品',
        baseEfficiency: 1.0
    },
    electronics: {
        name: '电子厂',
        emoji: '💻',
        unlockLevel: 1,
        cost: { money: 500000, steel: 30, silicon: 20 },
        produces: ['chips', 'components', 'software'],
        description: '制造电子产品',
        baseEfficiency: 1.0
    },
    manufacturing: {
        name: '制造厂',
        emoji: '🏭',
        unlockLevel: 2,
        cost: { money: 800000, steel_bar: 100, machinery: 10 },
        produces: ['steel_bar', 'machinery', 'textiles', 'paper'],
        description: '工业制造',
        baseEfficiency: 1.0
    },
    assembly: {
        name: '组装厂',
        emoji: '🔧',
        unlockLevel: 3,
        cost: { money: 1500000, machinery: 50, components: 20 },
        produces: ['smartphone', 'car', 'computer', 'clothing'],
        description: '产品组装',
        baseEfficiency: 1.0
    },
    luxury: {
        name: '奢侈品工坊',
        emoji: '💎',
        unlockLevel: 4,
        cost: { money: 5000000, components: 100, rare_earth: 50 },
        produces: ['luxury_car', 'premium_phone', 'designer_clothes'],
        description: '奢侈品制造',
        baseEfficiency: 1.0
    }
};

// 市场层级定义
const MARKET_TIERS = {
    local: {
        name: '本地市场',
        emoji: '🏪',
        unlockLevel: 0,
        allowedTiers: ['T1', 'T2'],
        priceMultiplier: 0.8,
        demandMultiplier: 2.0,
        description: '起步市场，价格较低但需求稳定'
    },
    domestic: {
        name: '国内市场',
        emoji: '🇨🇳',
        unlockLevel: 2,
        allowedTiers: ['T1', 'T2', 'T3'],
        priceMultiplier: 1.0,
        demandMultiplier: 1.5,
        description: '国内大市场，价格合理'
    },
    international: {
        name: '国际市场',
        emoji: '🌍',
        unlockLevel: 3,
        allowedTiers: ['T2', 'T3', 'T4'],
        priceMultiplier: 1.3,
        demandMultiplier: 1.0,
        description: '国际市场，高价但竞争激烈'
    },
    luxury: {
        name: '奢侈品市场',
        emoji: '💎',
        unlockLevel: 4,
        allowedTiers: ['T4', 'T5'],
        priceMultiplier: 2.0,
        demandMultiplier: 0.3,
        description: '高端市场，暴利但需求极少'
    }
};

// 技术树定义
const TECH_TREE = {
    automation_1: {
        name: '基础自动化',
        cost: { money: 500000, chips: 10 },
        unlockLevel: 1,
        effect: '工厂效率+20%',
        description: '基础的生产自动化'
    },
    efficiency_1: {
        name: '效率优化',
        cost: { money: 300000, software: 5 },
        unlockLevel: 1,
        effect: '生产成本-15%',
        description: '优化生产流程'
    },
    quality_1: {
        name: '质量控制',
        cost: { money: 400000, components: 20 },
        unlockLevel: 2,
        effect: '产品价值+25%',
        description: '提升产品质量'
    },
    automation_2: {
        name: '高级自动化',
        cost: { money: 2000000, computer: 5 },
        unlockLevel: 3,
        requires: ['automation_1'],
        effect: '工厂效率+50%，可设置自动生产',
        description: '高级自动化系统'
    },
    ai_optimization: {
        name: 'AI优化',
        cost: { money: 5000000, premium_phone: 2 },
        unlockLevel: 4,
        requires: ['automation_2', 'efficiency_1'],
        effect: '全自动生产，效率+100%',
        description: 'AI驱动的完全自动化'
    }
};

// 游戏状态
const gameState = {
    companies: new Map(),
    playerNames: new Map(),
    aiCompanies: [
        {
            id: 'ai_tech_giant',
            name: '科技巨头公司',
            value: 50000000,
            trend: 0,
            sector: '科技',
            companyType: 'tech',
            volatility: 0.15,
            underAttack: false
        },
        {
            id: 'ai_auto_corp',
            name: '汽车制造集团',
            value: 45000000,
            trend: 1,
            sector: '制造',
            companyType: 'manufacturing',
            volatility: 0.12,
            underAttack: false
        },
        {
            id: 'ai_luxury_brand',
            name: '奢侈品帝国',
            value: 35000000,
            trend: -1,
            sector: '奢侈品',
            companyType: 'luxury',
            volatility: 0.20,
            underAttack: false
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
    gameVersion: '2.0.0' // 版本号，用于重置检测
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
                    volume: 0
                };
            });
        }
    });
    
    return market;
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

// 生产任务类
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
}

// 10分钟事件系统
const TIMED_EVENTS = [
    {
        id: 'supply_shortage',
        name: '原料短缺',
        description: '全球供应链紧张，原材料价格上涨50%',
        duration: 600000, // 10分钟
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
        id: 'recession',
        name: '经济衰退',
        description: '经济下滑，消费品需求下降',
        duration: 600000,
        effects: {
            marketDemandMultiplier: { T3: 0.6, T4: 0.5 }
        }
    },
    {
        id: 'energy_crisis',
        name: '能源危机',
        description: '能源价格飙升，影响制造业',
        duration: 600000,
        effects: {
            marketPriceMultiplier: { oil: 2.0, fuel: 1.8 },
            productionCostMultiplier: { manufacturing: 1.4, chemical: 1.3 }
        }
    },
    {
        id: 'automation_trend',
        name: '自动化浪潮',
        description: '自动化技术普及，生产效率提升',
        duration: 600000,
        effects: {
            productionEfficiencyMultiplier: { all: 1.2 }
        }
    }
];

console.log('🏢 黑心公司大亨 v2.0 服务器启动中...');

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
                    message: '游戏已更新到v2.0，所有进度已重置。欢迎体验全新的多级产品制造系统！'
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
                inheritedFrom: oldPlayerId
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
                techTree: TECH_TREE
            });
            
            socket.broadcast.emit('companyJoined', {
                id: socket.id,
                name: companyName
            });
            
            if (inheritedData) {
                addChatMessage('系统', `${companyName} 重新回到了商业战场！`);
                addNewsEvent(`🔄 ${companyName} 王者归来，继承商业帝国重新参战`);
            } else {
                addChatMessage('系统', `${companyName} 进入了全新的商业世界！`);
                addNewsEvent(`🏢 ${companyName} 开始了多级产品制造之旅`);
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
            const playerLevel = calculateCompanyLevel(company.gameData);
            
            if (playerLevel < factory.unlockLevel) {
                socket.emit('error', { message: `需要等级 ${factory.unlockLevel} 才能解锁此工厂` });
                return;
            }
            
            if (!canAfford(company.gameData.inventory, factory.cost)) {
                socket.emit('error', { message: '资源不足，无法建造工厂' });
                return;
            }
            
            payCost(company.gameData.inventory, factory.cost);
            
            const factoryId = 'factory_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            company.gameData.factories[factoryId] = {
                type: factoryType,
                level: 1,
                efficiency: factory.baseEfficiency,
                automation: false,
                productionQueue: [],
                currentTask: null
            };
            
            socket.emit('factoryBuilt', {
                factoryId: factoryId,
                factoryType: factoryType,
                message: `成功建造 ${factory.name}！`,
                playerData: {
                    inventory: company.gameData.inventory,
                    factories: company.gameData.factories
                }
            });
            
            addChatMessage('工业快讯', `${company.name} 建造了 ${factory.name}`);
            
        } catch (error) {
            console.error('buildFactory error:', error);
        }
    });
    
    // 开始生产
    socket.on('startProduction', (data) => {
        try {
            const { factoryId, productId, quantity } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company || !company.gameData.factories[factoryId]) {
                return;
            }
            
            const factory = company.gameData.factories[factoryId];
            const factoryType = FACTORY_TYPES[factory.type];
            
            if (!factoryType.produces.includes(productId)) {
                socket.emit('error', { message: '此工厂无法生产该产品' });
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
            
            const task = new ProductionTask(factoryId, productId, quantity, socket.id);
            
            if (factory.automation && !factory.currentTask) {
                factory.currentTask = task;
            } else if (!factory.automation) {
                factory.currentTask = task;
            } else {
                factory.productionQueue.push(task);
            }
            
            socket.emit('productionStarted', {
                task: {
                    id: task.id,
                    productId: task.productId,
                    quantity: task.quantity,
                    completionTime: task.completionTime,
                    progress: task.getProgress()
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
    
    // 市场交易
    socket.on('marketTrade', (data) => {
        try {
            const { action, productId, quantity, marketType, multiplier } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company || !gameState.globalMarkets[marketType] || !gameState.globalMarkets[marketType][productId]) {
                return;
            }
            
            const market = gameState.globalMarkets[marketType][productId];
            const marketInfo = MARKET_TIERS[marketType];
            const playerLevel = calculateCompanyLevel(company.gameData);
            
            if (playerLevel < marketInfo.unlockLevel) {
                socket.emit('error', { message: `需要等级 ${marketInfo.unlockLevel} 才能进入此市场` });
                return;
            }
            
            const tradeAmount = quantity * (multiplier || 1);
            
            if (action === 'buy' && company.gameData.inventory.money >= market.price * tradeAmount) {
                company.gameData.inventory.money -= market.price * tradeAmount;
                company.gameData.inventory[productId] = (company.gameData.inventory[productId] || 0) + tradeAmount;
                
                market.demand += tradeAmount;
                market.volume += tradeAmount;
                market.price = Math.max(Math.floor(market.price * 0.5), market.price + Math.floor(tradeAmount * market.price * 0.02));
                
                socket.emit('tradeSuccess', {
                    action, productId, quantity: tradeAmount, marketType,
                    message: `在${marketInfo.name}购买了${tradeAmount}个${getProductByKey(productId).name}`,
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
                    message: `在${marketInfo.name}卖出了${tradeAmount}个${getProductByKey(productId).name}`,
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
            const playerLevel = calculateCompanyLevel(company.gameData);
            
            if (playerLevel < tech.unlockLevel) {
                socket.emit('error', { message: `需要等级 ${tech.unlockLevel} 才能研发此技术` });
                return;
            }
            
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
            money: 500000,
            // 给一些初始原料
            steel: 10,
            oil: 10,
            wood: 20,
            silicon: 5
        },
        factories: {},
        technologies: [],
        companyType: companyType,
        level: 0,
        experience: 0,
        automationSettings: {},
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
    Object.keys(gameData.factories || {}).forEach(factoryId => {
        const factory = gameData.factories[factoryId];
        const factoryType = FACTORY_TYPES[factory.type];
        if (factoryType) {
            value += factoryType.cost.money * factory.level;
        }
    });
    
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
        case 'automation_1':
            Object.keys(gameData.factories).forEach(factoryId => {
                gameData.factories[factoryId].efficiency *= 1.2;
            });
            break;
        case 'automation_2':
            Object.keys(gameData.factories).forEach(factoryId => {
                gameData.factories[factoryId].efficiency *= 1.5;
                gameData.factories[factoryId].automation = true;
            });
            break;
        case 'ai_optimization':
            Object.keys(gameData.factories).forEach(factoryId => {
                gameData.factories[factoryId].efficiency *= 2.0;
            });
            break;
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
                    companyType: company.companyType || 'tech'
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

// 处理生产任务完成
function processProductionTasks() {
    gameState.companies.forEach(company => {
        if (!company.gameData.factories) return;
        
        Object.keys(company.gameData.factories).forEach(factoryId => {
            const factory = company.gameData.factories[factoryId];
            
            if (factory.currentTask && factory.currentTask.isReady()) {
                const task = factory.currentTask;
                const product = getProductByKey(task.productId);
                
                // 完成生产
                company.gameData.inventory[task.productId] = (company.gameData.inventory[task.productId] || 0) + task.quantity;
                company.gameData.experience = (company.gameData.experience || 0) + task.quantity * 10;
                
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
                
                // 处理队列中的下一个任务
                factory.currentTask = null;
                if (factory.automation && factory.productionQueue.length > 0) {
                    factory.currentTask = factory.productionQueue.shift();
                }
            }
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
        Object.keys(event.effects.marketPriceMultiplier).forEach(tier => {
            Object.keys(gameState.globalMarkets).forEach(marketType => {
                Object.keys(gameState.globalMarkets[marketType]).forEach(productId => {
                    const product = getProductByKey(productId);
                    if (product && (tier === 'all' || getTierByProduct(productId) === tier)) {
                        gameState.globalMarkets[marketType][productId].price *= event.effects.marketPriceMultiplier[tier];
                    }
                });
            });
        });
    }
    
    if (event.effects.marketDemandMultiplier) {
        Object.keys(event.effects.marketDemandMultiplier).forEach(tier => {
            Object.keys(gameState.globalMarkets).forEach(marketType => {
                Object.keys(gameState.globalMarkets[marketType]).forEach(productId => {
                    if (getTierByProduct(productId) === tier) {
                        gameState.globalMarkets[marketType][productId].demand *= event.effects.marketDemandMultiplier[tier];
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
        // 更新AI公司价值（更频繁，更不可预测）
        gameState.aiCompanies.forEach(company => {
            const volatility = company.volatility * (1 + Math.random() * 0.5); // 随机增加波动性
            let change = (Math.random() - 0.5) * volatility * 2; // 增大变化幅度
            
            // 随机突发事件
            if (Math.random() < 0.05) { // 5%概率突发大变动
                change *= (Math.random() > 0.5 ? 3 : -3);
                const direction = change > 0 ? '暴涨' : '暴跌';
                addNewsEvent(`📊 ${company.name} 突发${direction}${Math.abs(change * 100).toFixed(1)}%！`);
            }
            
            company.value = Math.max(1000000, Math.floor(company.value * (1 + change)));
            company.trend = change > 0.02 ? 1 : change < -0.02 ? -1 : 0;
        });
        
        // 更新市场价格（更频繁的波动）
        Object.keys(gameState.globalMarkets).forEach(marketType => {
            Object.keys(gameState.globalMarkets[marketType]).forEach(productId => {
                const market = gameState.globalMarkets[marketType][productId];
                
                // 供需模拟
                const supplyDemandRatio = (market.demand + 1) / (market.supply + 1);
                let priceChange = (supplyDemandRatio - 1) * 0.05;
                
                // 随机市场噪音
                priceChange += (Math.random() - 0.5) * 0.08;
                
                // 应用全局事件效果
                if (gameState.globalEvent && gameState.globalEvent.effects) {
                    // 事件效果已在applyEventEffects中应用
                }
                
                market.price = Math.max(Math.floor(market.price * 0.3), Math.floor(market.price * (1 + priceChange)));
                market.trend = priceChange > 0.03 ? 1 : priceChange < -0.03 ? -1 : 0;
                
                // 重置供需
                market.supply = Math.max(50, market.supply * 0.95 + Math.random() * 20);
                market.demand = Math.max(30, market.demand * 0.95 + Math.random() * 30);
            });
        });
        
        io.emit('marketUpdate', gameState.globalMarkets);
        
    } catch (error) {
        console.error('updateMarketsAndAI error:', error);
    }
}

// 定时器设置
setInterval(processProductionTasks, 5000); // 每5秒检查生产任务
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
        console.log(`🚀 黑心公司大亨 v2.0 服务器运行在端口 ${PORT}`);
        console.log(`🌐 访问地址: http://localhost:${PORT}`);
        console.log(`💼 等待CEO们体验全新的多级制造系统...`);
        console.log(`📊 新特性: 多级产品 | 专业工厂 | 分层市场 | 10分钟事件周期`);
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

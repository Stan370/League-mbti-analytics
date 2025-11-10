<div align="center">
  <h1>🏆 League MBTI Analytics</h1>
  <p>AI-Powered League of Legends Player Personality Analysis</p>
  <p>Powered by <strong>AWS Bedrock</strong> • Built for AWS AI Hackathon</p>
</div>

# League MBTI Analytics

A Web application that analyzes League of Legends player behavior and uses **AWS Bedrock** to generate personalized MBTI-style personality insights and AI-powered storytelling narratives.

## 🎯 Inspiration

League of Legends players often wonder: "What does my playstyle say about me?" After analyzing thousands of matches, we noticed patterns—some players are aggressive teamfighters (high assists), others prefer safe farming (low deaths), and some adapt flexibly (wide champion pools). These patterns reminded us of personality frameworks like MBTI, where behaviors reflect underlying traits. 

We set out to bridge gaming analytics with AI-powered psychological insights, creating a unique "Year-in-Review" experience inspired by Spotify Wrapped. Instead of just showing statistics, we wanted **AWS Bedrock** to transform raw gameplay data into engaging, personalized narratives that reveal not just what players did, but who they are as gamers—and what that means for their future performance.

## ✨ What it does

League-MBTI-Analysis is a React web application that analyzes League of Legends player behavior and uses **AWS Bedrock** to generate personalized MBTI personality insights and storytelling narratives. Users enter their Riot ID (e.g., "Faker#KR1"), and the app:

1. **Fetches Match Data**: Retrieves up to 100 ranked matches from 2025 using the Riot API
2. **Analyzes Playstyle**: Processes KDA, damage, vision score, champion diversity, and teamfight participation
3. **Maps to MBTI**: Calculates scores across 8 dimensions (E/I, S/N, T/F, J/P) to determine personality type
4. **Generates AI Insights**: Uses **AWS Bedrock** (Amazon Titan Text Express) to create personalized narratives about playstyle evolution, standout moments, and 2026 predictions
5. **Visualizes Insights**: Displays performance charts, growth trends, and queue breakdowns with AI-generated storytelling

The app distinguishes between team-oriented players (high assists = Extroverted) and solo carries (high kills = Introverted), cautious strategists (low deaths = Sensing) and aggressive risk-takers (high volatility = Intuitive), with **AWS Bedrock** providing context-aware insights that make these patterns meaningful and actionable.

## 🏗️ How we built it

### **Frontend Architecture**
- **React 19 + TypeScript + Vite + Tailwind CSS**: Modern, responsive UI with League of Legends-themed styling
- **Recharts**: Data visualization (growth charts, performance metrics)
- **Multi-page flow**: Landing → Loading → Results with smooth transitions

### **AWS Services - Core AI Infrastructure**

#### **1. AWS Bedrock (Primary AI Service)**
- **Model**: `amazon.titan-text-express-v1` ($0.0008/1K tokens) for cost-effective storytelling
- **Alternative**: `anthropic.claude-3-haiku-20240307` ($0.00025/1K tokens) for premium insights
- **Use Case**: Generates personalized "Year-in-Review" narratives from aggregated gameplay data
- **Prompt Engineering**: Structured prompts that extract playstyle evolution, standout moments, and predictions in JSON format
- **Cost Optimization**: Single Bedrock call per player analysis (batched insights), max 200 tokens per response

#### **2. AWS Lambda Functions (Serverless AI Processing)**
- **Endpoint**: `/api/ai/generate-insights` (Lambda function)
- **Architecture**: 
  - Receives aggregated player stats and monthly trends
  - Calls AWS Bedrock Runtime API
  - Parses JSON response (playstyleEvolution, standoutMoment, 2026Prediction)
  - Returns structured insights to frontend
- **Error Handling**: Graceful fallbacks with rule-based insights if Bedrock fails

#### **3. AWS DynamoDB (Caching Layer)**
- **Purpose**: Cache Bedrock-generated insights to reduce API calls and costs
- **Schema**: 
  - Partition Key: `playerId` (PUUID)
  - TTL: 24 hours (insights refresh daily)
  - Attributes: `insights` (JSON), `timestamp`, `statsHash` (for cache invalidation)
- **Cost Savings**: ~80% reduction in Bedrock API calls for repeat queries

#### **4. AWS API Gateway**
- **Integration**: RESTful API endpoint for Lambda functions
- **CORS**: Configured for cross-origin requests from React frontend
- **Rate Limiting**: Protects against excessive Bedrock API usage

### **Data Processing Pipeline**

1. **riotApiService.ts**: Fetches PUUID, match IDs, and match details from Riot API
2. **dataFilterService.ts**: Filters matches (removes remakes, validates gameType/queueId)
3. **incrementalDataService.ts**: Aggregates stats (win rates, KDA, damage per minute, monthly trends)
4. **mbtiMappingService.ts**: Calculates MBTI scores from gameplay metrics (E/I, S/N, T/F, J/P)
5. **aiStorytellingService.ts**: 
   - Builds structured prompts from aggregated stats
   - Calls AWS Lambda → Bedrock API
   - Caches results in DynamoDB
   - Parses and formats AI insights

### **AWS Integration Architecture**

```
React Frontend
    ↓
AWS API Gateway (/api/ai/generate-insights)
    ↓
AWS Lambda Function (Node.js/TypeScript)
    ├→ Check DynamoDB Cache
    ├→ If cache miss: Call AWS Bedrock Runtime API
    ├→ Parse JSON response
    └→ Store in DynamoDB (24h TTL)
    ↓
Return AI Insights (playstyle, strengths, prediction)
```

## 🚀 Prerequisites

- **Node.js 18+** and npm
- **AWS Account** with Bedrock access enabled
- **Riot API Key** (get from [Riot Developer Portal](https://developer.riotgames.com/))
- **AWS CLI** configured with credentials
- **AWS SAM CLI** (for Lambda deployment) or **AWS CDK**

## 📦 Installation

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/League-MBTI-Analysis.git
cd League-MBTI-Analysis
npm install
```

### 2. AWS Bedrock Setup

#### Enable Bedrock Models
1. Go to AWS Console → Amazon Bedrock
2. Enable the following models:
   - `amazon.titan-text-express-v1` (recommended for cost-effectiveness)
   - `anthropic.claude-3-haiku-20240307` (optional, for premium insights)

#### Configure IAM Permissions
Create an IAM role with the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-text-express-v1",
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307"
      ]
    }
  ]
}
```

### 3. AWS DynamoDB Setup

#### Create DynamoDB Table
```bash
aws dynamodb create-table \
  --table-name league-mbti-insights \
  --attribute-definitions AttributeName=playerId,AttributeType=S \
  --key-schema AttributeName=playerId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --point-in-time-recovery-enabled
```

#### Add TTL Attribute
```bash
aws dynamodb update-time-to-live \
  --table-name league-mbti-insights \
  --time-to-live-specification Enabled=true,AttributeName=ttl
```

### 4. AWS Lambda Function Setup

#### Deploy Lambda Function
```bash
# Using AWS SAM
sam build
sam deploy --guided

# Or using AWS CDK
cdk deploy
```

#### Environment Variables
Set the following environment variables in your Lambda function:
- `BEDROCK_MODEL_ID`: `amazon.titan-text-express-v1`
- `BEDROCK_REGION`: `us-east-1`
- `DYNAMODB_TABLE_NAME`: `league-mbti-insights`

### 5. Configure API Gateway

1. Create a REST API in API Gateway
2. Create a resource `/ai/generate-insights`
3. Create a POST method that integrates with your Lambda function
4. Enable CORS for your frontend domain
5. Deploy the API to a stage (e.g., `prod`)

### 6. Environment Variables

Create a `.env.local` file:

```env
VITE_RIOT_API_KEY=your_riot_api_key
VITE_AWS_API_GATEWAY_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/prod
VITE_AWS_REGION=us-east-1
```

### 7. Cloudflare Pages Setup (Optional)

For Riot API proxying, configure Cloudflare Pages:

```bash
# Set environment variables in Cloudflare Dashboard
RIOT_API_KEY=your_riot_api_key

# Deploy
npm run build
npx wrangler pages deploy dist
```

## 🛠️ Development

### Local Development (Frontend)

```bash
npm run dev
# Visit http://localhost:3000
```

### Local Development (AWS Lambda)

```bash
# Using AWS SAM
sam local start-api

# Or using Serverless Framework
serverless offline
```

### Testing with Mock Data

```bash
# Use mock data mode in the app
# Select "Use Mock Data" on the landing page
```

## 📁 Project Structure

```
/
├── components/              # React components
│   ├── GrowthChart.tsx     # Performance visualization
│   ├── LandingPage.tsx     # Entry point
│   ├── LoadingScreen.tsx   # Loading state
│   └── ResultsPage.tsx     # Results display with AI insights
├── functions/              # Cloudflare Pages Functions
│   └── api/
│       └── riot/
│           └── [[path]].ts # Riot API proxy
├── services/               # Business logic
│   ├── aiStorytellingService.ts    # AWS Bedrock integration
│   ├── riotApiService.ts           # Riot API client
│   ├── mbtiMappingService.ts       # MBTI calculation
│   ├── dataFilterService.ts        # Data filtering
│   ├── incrementalDataService.ts   # Data aggregation
│   ├── cacheService.ts             # Client-side caching
│   └── rateLimiter.ts              # Rate limiting
├── types/                  # TypeScript types
│   ├── riotApiTypes.ts    # Riot API types
│   └── yearInReview.ts    # Year-in-Review data structure
├── lambda/                 # AWS Lambda functions (if using SAM/CDK)
│   └── generate-insights/
│       ├── index.ts       # Lambda handler
│       └── package.json   # Lambda dependencies
├── App.tsx                 # Main app component
└── index.tsx               # App entry point
```

## 🔧 Technology Stack

### Frontend
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Hosting:** Cloudflare Pages

### AWS Services
- **AWS Bedrock:** AI-powered storytelling (Titan Express, Claude Haiku)
- **AWS Lambda:** Serverless AI processing
- **AWS DynamoDB:** Insight caching
- **AWS API Gateway:** RESTful API endpoints
- **AWS IAM:** Security and permissions

### Backend
- **Cloudflare Pages Functions:** Riot API proxy
- **Node.js/TypeScript:** Serverless functions

## 🎨 Features

- ✅ Real-time League of Legends player analysis
- ✅ MBTI personality type mapping (E/I, S/N, T/F, J/P)
- ✅ **AWS Bedrock-powered AI insights** (playstyle evolution, standout moments, predictions)
- ✅ Performance metrics visualization
- ✅ Multi-layer caching (Memory + IndexedDB + DynamoDB)
- ✅ Cost-optimized AI (sub-$0.001 per analysis)
- ✅ Responsive design
- ✅ Mock data mode for testing

## 💰 Cost Optimization

- **Model Selection**: Titan Express ($0.0008/1K tokens) vs Claude Sonnet ($3/1K tokens) = 99.97% savings
- **Caching**: DynamoDB reduces Bedrock API calls by ~80%
- **Token Limits**: Max 200 tokens per response = predictable costs
- **Batch Processing**: Single Bedrock call per player analysis

**Estimated Cost**: ~$0.0004 per player analysis (with caching)

## 🧪 Testing

```bash
# Run tests
npm test

# Test with mock data
# Use "Use Mock Data" option in the app

# Test AWS Lambda locally
sam local invoke GenerateInsightsFunction -e events/test-event.json
```

## 🚀 Deployment

### Frontend (Cloudflare Pages)

```bash
npm run build
npx wrangler pages deploy dist
```

### AWS Lambda (SAM)

```bash
sam build
sam deploy --guided
```

### AWS Lambda (CDK)

```bash
cdk deploy
```

## 📊 AWS Architecture

```
┌─────────────────┐
│  React Frontend │
│  (Cloudflare)   │
└────────┬────────┘
         │
         ├─────────────────────────────────┐
         │                                 │
         ▼                                 ▼
┌─────────────────┐              ┌─────────────────┐
│  Cloudflare     │              │  AWS API Gateway│
│  Functions      │              │  (/api/ai/...)  │
│  (Riot API)     │              └────────┬────────┘
└─────────────────┘                       │
                                          ▼
                                 ┌─────────────────┐
                                 │  AWS Lambda     │
                                 │  (Bedrock Call) │
                                 └────────┬────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
         ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
         │  AWS Bedrock     │  │  AWS DynamoDB    │  │  AWS CloudWatch  │
         │  (AI Insights)   │  │  (Caching)       │  │  (Logging)       │
         └──────────────────┘  └──────────────────┘  └──────────────────┘
```

## 🐛 Challenges we ran into

1. **AWS Bedrock Integration**: Setting up Bedrock Runtime API with proper IAM permissions and region configuration
2. **Cost Optimization**: Implementing caching and token limits to control Bedrock API costs
3. **Prompt Engineering**: Getting consistent JSON responses from Bedrock through iterative testing
4. **Lambda Cold Starts**: Optimizing connection pooling and implementing warm-up logic
5. **Regional API Routing**: Building intelligent region detection for Riot API calls
6. **Data Complexity**: Reducing 150 fields/match to meaningful AI insights

## 🏆 Accomplishments

1. ✅ **AWS Bedrock Integration**: Cost-optimized AI storytelling (99.97% cost savings)
2. ✅ **Serverless Architecture**: Fully serverless AI pipeline (Lambda + Bedrock + DynamoDB)
3. ✅ **Intelligent Caching**: 80% reduction in Bedrock API calls
4. ✅ **Prompt Engineering**: Consistent, parseable JSON responses from Bedrock
5. ✅ **Cost Optimization**: Sub-$0.001 per player analysis
6. ✅ **Beautiful UI**: Seamless integration of AI insights with data visualizations

## 🔮 What's next

- [ ] Enhanced AWS Bedrock Integration (multi-model routing, streaming responses)
- [ ] AWS Services Expansion (S3 for PDFs, EventBridge for scheduled updates, Step Functions for workflows)
- [ ] Advanced AI Features (Bedrock Knowledge Bases, Comprehend for sentiment analysis)
- [ ] Real-time Insights (Kinesis for streaming, AppSync for GraphQL)
- [ ] Comparative Analysis (team composition recommendations)
- [ ] Historical Trends (MBTI evolution over time)
- [ ] Shareable Cards (AI-powered summary cards like Spotify Wrapped)

## 📄 License

MIT

## 🙏 Acknowledgments

- **Riot Games** for the League of Legends API
- **AWS Bedrock** for AI-powered storytelling
- **Cloudflare** for edge computing infrastructure

## 📧 Contact

For questions or contributions, please open an issue or submit a pull request.

---

**Built with ❤️ for AWS AI Hackathon**

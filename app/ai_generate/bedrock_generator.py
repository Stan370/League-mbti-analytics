import boto3
import json
from typing import Dict

class BedrockGenerator:
    """Generate personality insights using AWS Bedrock"""
    
    def __init__(self, region: str = "us-east-1"):
        self.client = boto3.client("bedrock-runtime", region_name=region)
        self.model_id = "anthropic.claude-3-sonnet-20240229-v1:0"
    
    def generate_mbti_profile(self, metrics: Dict[str, float], matches: list) -> Dict:
        """Generate MBTI-style personality profile from behavioral metrics"""
        
        prompt = self._build_prompt(metrics, matches)
        
        response = self.client.invoke_model(
            modelId=self.model_id,
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 2000,
                "messages": [{
                    "role": "user",
                    "content": prompt
                }]
            })
        )
        
        result = json.loads(response["body"].read())
        content = result["content"][0]["text"]
        
        return self._parse_response(content)
    
    def _build_prompt(self, metrics: Dict[str, float], matches: list) -> str:
        """Build prompt for Bedrock model"""
        return f"""Analyze this League of Legends player's behavioral data and create a personality profile:

Behavioral Metrics:
- Aggression: {metrics['aggression']:.2f}
- Teamwork: {metrics['teamwork']:.2f}
- Vision Control: {metrics['vision']:.2f}
- Objective Focus: {metrics['objective_focus']:.2f}
- Risk Taking: {metrics['risk_taking']:.2f}

Total Matches Analyzed: {len(matches)}

Generate:
1. MBTI-style archetype (4 letters, e.g., ENTJ)
2. Archetype name (e.g., "The Strategic Commander")
3. 2-3 sentence personality summary
4. 3 key strengths
5. 2 growth areas
6. A personalized season story (3-4 sentences)

Format as JSON with keys: archetype, archetype_name, summary, strengths, growth_areas, season_story"""
    
    def _parse_response(self, content: str) -> Dict:
        """Parse Bedrock response into structured data"""
        try:
            # Try to extract JSON from response
            start = content.find("{")
            end = content.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(content[start:end])
        except:
            pass
        
        # Fallback structure
        return {
            "archetype": "ENTJ",
            "archetype_name": "The Rift Strategist",
            "summary": content[:200],
            "strengths": ["Adaptive playstyle", "Strong fundamentals"],
            "growth_areas": ["Vision control", "Objective timing"],
            "season_story": content
        }

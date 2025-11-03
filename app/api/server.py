from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_ingest.riot_client import RiotClient
from feature_extract.behavior_analyzer import BehaviorAnalyzer
from ai_generate.bedrock_generator import BedrockGenerator

app = Flask(__name__)
CORS(app)

@app.route('/api/analyze', methods=['POST'])
def analyze():
    data = request.json
    game_name = data.get('gameName')
    tag_line = data.get('tagLine')
    region = data.get('region', 'kr')
    
    try:
        riot = RiotClient(region=get_routing_value(region))
        
        account = riot.get_account_by_riot_id(game_name, tag_line)
        puuid = account['puuid']
        
        match_ids = riot.get_match_history(puuid, count=20)
        matches = []
        for match_id in match_ids[:20]:
            match_detail = riot.get_match_details(match_id)
            matches.append(match_detail)
        
        analyzer = BehaviorAnalyzer()
        metrics = analyzer.analyze_matches(matches, puuid)
        champions = analyzer.get_champion_stats(matches, puuid)
        
        generator = BedrockGenerator()
        profile = generator.generate_mbti_profile(metrics, matches)
        
        return jsonify({
            'metrics': metrics,
            'profile': profile,
            'champions': champions,
            'match_count': len(matches)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_routing_value(region):
    mapping = {
        'na1': 'americas',
        'br1': 'americas',
        'euw1': 'europe',
        'eun1': 'europe',
        'kr': 'asia',
        'jp1': 'asia'
    }
    return mapping.get(region, 'americas')

if __name__ == '__main__':
    app.run(debug=True, port=5000)

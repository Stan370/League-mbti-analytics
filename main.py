#!/usr/bin/env python3
import os
import json
import argparse
from dotenv import load_dotenv

from data_ingest.riot_client import RiotClient
from feature_extract.behavior_analyzer import BehaviorAnalyzer
from ai_generate.bedrock_generator import BedrockGenerator
from visualize.radar_chart import RadarChart

def main(puuid: str, match_count: int = 20):
    """Main orchestration pipeline"""
    
    load_dotenv()
    
    print(f"🎮 Analyzing player: {puuid}")
    
    # 1. Data Ingestion
    print("\n📥 Fetching match history from Riot API...")
    riot = RiotClient()
    match_ids = riot.get_match_history(puuid, count=match_count)
    matches = [riot.get_match_details(mid) for mid in match_ids[:match_count]]
    print(f"✓ Loaded {len(matches)} matches")
    
    # 2. Feature Extraction
    print("\n🔍 Extracting behavioral patterns...")
    analyzer = BehaviorAnalyzer()
    metrics = analyzer.analyze_matches(matches)
    print(f"✓ Computed metrics: {json.dumps(metrics, indent=2)}")
    
    # 3. AI Generation
    print("\n🧠 Generating personality profile with AWS Bedrock...")
    generator = BedrockGenerator()
    profile = generator.generate_mbti_profile(metrics, matches)
    print(f"✓ Profile: {profile['archetype']} - {profile['archetype_name']}")
    print(f"\n{profile['summary']}")
    
    # 4. Visualization
    print("\n📊 Creating visualization...")
    visualizer = RadarChart()
    html = visualizer.generate_html(metrics)    
    
    output_file = "profile_output.html"
    with open(output_file, "w") as f:
        f.write(html)
    print(f"✓ Saved to {output_file}")
    
    # Save full profile
    with open("profile_data.json", "w") as f:
        json.dump({
            "metrics": metrics,
            "profile": profile,
            "match_count": len(matches)
        }, f, indent=2)
    
    print("\n✨ Analysis complete!")
    return profile

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="League MBTI AI Assistant")
    parser.add_argument("--puuid", required=True, help="Player PUUID")
    parser.add_argument("--matches", type=int, default=20, help="Number of matches to analyze")
    
    args = parser.parse_args()
    main(args.puuid, args.matches)

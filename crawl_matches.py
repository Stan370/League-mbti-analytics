#!/usr/bin/env python3
"""
Match crawler script using pure match-v5 method.

Usage:
    python crawl_matches.py --seed-puuid <PUUID> [options]
    
Example:
    python crawl_matches.py --seed-puuid "abc123..." --max-puuids 100 --max-matches 500
"""

import os
import argparse
import json
from dotenv import load_dotenv
from app.data_ingest.riot_client import RiotClient
from app.data_ingest.match_crawler import MatchCrawler


def main():
    parser = argparse.ArgumentParser(
        description="Crawl League of Legends matches using pure match-v5 method"
    )
    parser.add_argument(
        "--seed-puuid",
        required=True,
        help="Initial PUUID to start crawling from"
    )
    parser.add_argument(
        "--region",
        default="americas",
        help="Riot API region (americas, europe, asia)"
    )
    parser.add_argument(
        "--max-puuids",
        type=int,
        default=100,
        help="Maximum number of PUUIDs to process (default: 100)"
    )
    parser.add_argument(
        "--max-matches",
        type=int,
        default=500,
        help="Maximum number of matches to fetch (default: 500)"
    )
    parser.add_argument(
        "--matches-per-puuid",
        type=int,
        default=20,
        help="Number of matches to fetch per PUUID (default: 20)"
    )
    parser.add_argument(
        "--queue",
        type=int,
        nargs="+",
        help="Queue IDs to filter (e.g., 420 for ranked solo, 450 for ARAM)"
    )
    parser.add_argument(
        "--rate-limit-delay",
        type=float,
        default=0.1,
        help="Delay between API calls in seconds (default: 0.1)"
    )
    parser.add_argument(
        "--output",
        default="crawl_results.json",
        help="Output file path (default: crawl_results.json)"
    )
    parser.add_argument(
        "--resume",
        help="Resume from a previous crawl state file"
    )
    
    args = parser.parse_args()
    
    load_dotenv()
    
    # Initialize Riot client
    riot_client = RiotClient(region=args.region)
    
    # Initialize crawler
    crawler = MatchCrawler(
        riot_client=riot_client,
        max_puuids=args.max_puuids,
        max_matches=args.max_matches,
        matches_per_puuid=args.matches_per_puuid,
        queue_filter=args.queue,
        rate_limit_delay=args.rate_limit_delay,
        on_progress=lambda p, m, q: print(f"   Progress: {p} PUUIDs, {m} matches, {q} in queue")
    )
    
    # Resume from previous state if provided
    if args.resume:
        crawler.load_state(args.resume)
        # Add seed to queue if not already processed
        if args.seed_puuid not in crawler.visited_puuids:
            crawler.puuid_queue.append(args.seed_puuid)
    
    # Start crawling
    results = crawler.crawl(args.seed_puuid)
    
    # Save results
    crawler.save_results(args.output, include_matches=True)
    
    # Print summary
    print("\n" + "="*60)
    print("CRAWL SUMMARY")
    print("="*60)
    print(f"PUUIDs processed: {results['total_puuids_processed']}")
    print(f"Matches fetched: {results['total_matches_fetched']}")
    print(f"Unique players discovered: {results['unique_puuids_discovered']}")
    print(f"Results saved to: {args.output}")
    print("="*60)
    
    return results


if __name__ == "__main__":
    main()


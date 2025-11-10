import time
import json
from typing import Dict, List, Set, Optional, Callable
from collections import deque
from data_ingest.riot_client import RiotClient


class MatchCrawler:
    """
    Pure match-v5 crawler that recursively expands through match participants.
    
    Method 2: Start with one PUUID, get their matchlist, fetch matches,
    extract other 9 participants, and recursively process all collected PUUIDs.
    """
    
    def __init__(
        self,
        riot_client: RiotClient,
        max_puuids: int = 1000,
        max_matches: int = 5000,
        matches_per_puuid: int = 20,
        queue_filter: Optional[List[int]] = None,
        rate_limit_delay: float = 0.1,
        on_match_fetched: Optional[Callable[[Dict], None]] = None,
        on_progress: Optional[Callable[[int, int, int], None]] = None
    ):
        """
        Initialize the match crawler.
        
        Args:
            riot_client: RiotClient instance for API calls
            max_puuids: Maximum number of unique PUUIDs to process
            max_matches: Maximum number of unique matches to fetch
            matches_per_puuid: Number of matches to fetch per PUUID
            queue_filter: Optional list of queue IDs to filter (e.g., [420] for ranked solo)
            rate_limit_delay: Delay between API calls in seconds
            on_match_fetched: Optional callback when a match is fetched (match_data)
            on_progress: Optional callback for progress updates (processed_puuids, fetched_matches, queue_size)
        """
        self.client = riot_client
        self.max_puuids = max_puuids
        self.max_matches = max_matches
        self.matches_per_puuid = matches_per_puuid
        self.queue_filter = queue_filter
        self.rate_limit_delay = rate_limit_delay
        
        # State tracking
        self.visited_puuids: Set[str] = set()
        self.fetched_matches: Set[str] = set()
        self.puuid_queue: deque = deque()
        self.all_matches: List[Dict] = []
        
        # Callbacks
        self.on_match_fetched = on_match_fetched
        self.on_progress = on_progress
    
    def extract_participants(self, match: Dict) -> List[str]:
        """
        Extract all participant PUUIDs from a match.
        
        Args:
            match: Match data from get_match_details()
            
        Returns:
            List of participant PUUIDs
        """
        # Try metadata.participants first (simpler, just PUUIDs)
        participants = match.get("metadata", {}).get("participants", [])
        if participants:
            return participants
        
        # Fallback to info.participants (detailed data)
        participants = match.get("info", {}).get("participants", [])
        return [p.get("puuid") for p in participants if p.get("puuid")]
    
    def should_fetch_match(self, match_id: str, match_data: Optional[Dict] = None) -> bool:
        """
        Determine if a match should be fetched based on filters.
        
        Args:
            match_id: Match ID
            match_data: Optional match data if already fetched
            
        Returns:
            True if match should be processed
        """
        # Skip if already fetched
        if match_id in self.fetched_matches:
            return False
        
        # If we have match data, check queue filter
        if match_data and self.queue_filter:
            queue_id = match_data.get("info", {}).get("queueId")
            if queue_id not in self.queue_filter:
                return False
        
        return True
    
    def crawl(self, seed_puuid: str) -> Dict:
        """
        Start crawling from a seed PUUID.
        
        Args:
            seed_puuid: Initial PUUID to start crawling from
            
        Returns:
            Dictionary with crawl results:
            {
                "total_puuids_processed": int,
                "total_matches_fetched": int,
                "unique_puuids_discovered": int,
                "matches": List[Dict]
            }
        """
        print(f"🚀 Starting match crawler with seed PUUID: {seed_puuid[:20]}...")
        print(f"   Max PUUIDs: {self.max_puuids}, Max Matches: {self.max_matches}")
        if self.queue_filter:
            print(f"   Queue filter: {self.queue_filter}")
        
        # Initialize queue with seed
        self.puuid_queue.append(seed_puuid)
        
        processed_count = 0
        
        while self.puuid_queue and processed_count < self.max_puuids:
            # Check if we've hit match limit
            if len(self.fetched_matches) >= self.max_matches:
                print(f"✓ Reached max matches limit ({self.max_matches})")
                break
            
            # Get next PUUID
            current_puuid = self.puuid_queue.popleft()
            
            # Skip if already processed
            if current_puuid in self.visited_puuids:
                continue
            
            # Mark as visited
            self.visited_puuids.add(current_puuid)
            processed_count += 1
            
            try:
                # Fetch match history for this PUUID
                print(f"\n[{processed_count}/{self.max_puuids}] Processing PUUID: {current_puuid[:20]}...")
                match_ids = self.client.get_match_history(
                    current_puuid,
                    count=self.matches_per_puuid
                )
                
                if not match_ids:
                    print(f"   ⚠️  No matches found")
                    continue
                
                print(f"   📋 Found {len(match_ids)} matches")
                
                # Fetch each match
                new_participants = set()
                matches_fetched_this_round = 0
                
                for match_id in match_ids:
                    # Rate limiting
                    time.sleep(self.rate_limit_delay)
                    
                    # Check if we should fetch this match
                    if not self.should_fetch_match(match_id):
                        continue
                    
                    try:
                        # Fetch match details
                        match_data = self.client.get_match_details(match_id)
                        
                        # Check queue filter if we have match data
                        if self.queue_filter:
                            queue_id = match_data.get("info", {}).get("queueId")
                            if queue_id not in self.queue_filter:
                                continue
                        
                        # Mark as fetched
                        self.fetched_matches.add(match_id)
                        self.all_matches.append(match_data)
                        matches_fetched_this_round += 1
                        
                        # Extract participants
                        participants = self.extract_participants(match_data)
                        for puuid in participants:
                            if puuid and puuid not in self.visited_puuids:
                                new_participants.add(puuid)
                        
                        # Callback for match fetched
                        if self.on_match_fetched:
                            self.on_match_fetched(match_data)
                        
                    except Exception as e:
                        print(f"   ⚠️  Error fetching match {match_id}: {e}")
                        continue
                
                print(f"   ✓ Fetched {matches_fetched_this_round} new matches")
                print(f"   👥 Discovered {len(new_participants)} new participants")
                
                # Add new participants to queue
                for puuid in new_participants:
                    if len(self.visited_puuids) + len(self.puuid_queue) < self.max_puuids:
                        self.puuid_queue.append(puuid)
                
                # Progress callback
                if self.on_progress:
                    self.on_progress(
                        processed_count,
                        len(self.fetched_matches),
                        len(self.puuid_queue)
                    )
                
            except Exception as e:
                print(f"   ⚠️  Error processing PUUID {current_puuid[:20]}: {e}")
                continue
        
        result = {
            "total_puuids_processed": processed_count,
            "total_matches_fetched": len(self.fetched_matches),
            "unique_puuids_discovered": len(self.visited_puuids),
            "matches": self.all_matches
        }
        
        print(f"\n✨ Crawl complete!")
        print(f"   Processed {processed_count} PUUIDs")
        print(f"   Fetched {len(self.fetched_matches)} unique matches")
        print(f"   Discovered {len(self.visited_puuids)} unique players")
        
        return result
    
    def save_results(self, filepath: str, include_matches: bool = True):
        """
        Save crawl results to a JSON file.
        
        Args:
            filepath: Path to save the results
            include_matches: Whether to include full match data (can be large)
        """
        data = {
            "metadata": {
                "total_puuids_processed": len(self.visited_puuids),
                "total_matches_fetched": len(self.fetched_matches),
                "unique_puuids_discovered": len(self.visited_puuids),
                "visited_puuids": list(self.visited_puuids),
                "fetched_match_ids": list(self.fetched_matches)
            }
        }
        
        if include_matches:
            data["matches"] = self.all_matches
        
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)
        
        print(f"💾 Results saved to {filepath}")
    
    def load_state(self, filepath: str):
        """
        Load previous crawl state to resume.
        
        Args:
            filepath: Path to previously saved state
        """
        with open(filepath, "r") as f:
            data = json.load(f)
        
        metadata = data.get("metadata", {})
        self.visited_puuids = set(metadata.get("visited_puuids", []))
        self.fetched_matches = set(metadata.get("fetched_match_ids", []))
        
        if "matches" in data:
            self.all_matches = data["matches"]
        
        print(f"📂 Loaded state: {len(self.visited_puuids)} PUUIDs, {len(self.fetched_matches)} matches")


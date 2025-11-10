import os
import requests
from typing import Dict, List

class RiotClient:
    def __init__(self, api_key: str = None, region: str = "americas"):
        self.api_key = api_key or os.getenv("RIOT_API_KEY")
        self.region = region
        self.base_url = f"https://{region}.api.riotgames.com"
        self.headers = {"X-Riot-Token": self.api_key}
    
    def get_account_by_riot_id(self, game_name: str, tag_line: str) -> Dict:
        url = f"{self.base_url}/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}"
        return requests.get(url, headers=self.headers).json()
    
    def get_account_by_puuid(self, puuid: str) -> Dict:
        url = f"{self.base_url}/riot/account/v1/accounts/by-puuid/{puuid}"
        return requests.get(url, headers=self.headers).json()
    
    def get_match_history(
        self, 
        puuid: str, 
        count: int = 20,
        queue: int = None,
        start: int = 0,
        start_time: int = None,
        end_time: int = None
    ) -> List[str]:
        """
        Get match history for a PUUID.
        
        Args:
            puuid: Player's PUUID
            count: Number of matches to return (default 20, max 100)
            queue: Optional queue ID filter (e.g., 420 for ranked solo)
            start: Start index for pagination
            start_time: Optional start timestamp (epoch milliseconds)
            end_time: Optional end timestamp (epoch milliseconds)
            
        Returns:
            List of match IDs
        """
        url = f"https://{self.region}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids"
        params = {"count": min(count, 100)}  # API max is 100
        
        if queue is not None:
            params["queue"] = queue
        if start > 0:
            params["start"] = start
        if start_time is not None:
            params["startTime"] = start_time
        if end_time is not None:
            params["endTime"] = end_time
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        return response.json()
    
    def get_match_details(self, match_id: str) -> Dict:
        url = f"https://{self.region}.api.riotgames.com/lol/match/v5/matches/{match_id}"
        return requests.get(url, headers=self.headers).json()
    
    def get_champion_mastery(self, puuid: str, platform: str = "na1") -> List[Dict]:
        url = f"https://{platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}"
        return requests.get(url, headers=self.headers).json()

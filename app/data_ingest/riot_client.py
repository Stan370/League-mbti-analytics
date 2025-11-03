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
    
    def get_match_history(self, puuid: str, count: int = 20) -> List[str]:
        platform = "na1"  # adjust based on region
        url = f"https://{self.region}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids"
        params = {"count": count}
        return requests.get(url, headers=self.headers, params=params).json()
    
    def get_match_details(self, match_id: str) -> Dict:
        url = f"https://{self.region}.api.riotgames.com/lol/match/v5/matches/{match_id}"
        return requests.get(url, headers=self.headers).json()
    
    def get_champion_mastery(self, puuid: str, platform: str = "na1") -> List[Dict]:
        url = f"https://{platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}"
        return requests.get(url, headers=self.headers).json()

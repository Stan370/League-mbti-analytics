import numpy as np
from typing import Dict, List

class BehaviorAnalyzer:
    """Extract behavioral vectors from match data"""
    
    def analyze_matches(self, matches: List[Dict], puuid: str) -> Dict[str, float]:
        """Compute behavioral metrics from match history"""
        metrics = {
            "aggression": 0.0,
            "teamwork": 0.0,
            "vision": 0.0,
            "objective_focus": 0.0,
            "risk_taking": 0.0,
            "adaptability": 0.0
        }
        
        for match in matches:
            participant = self._find_participant(match, puuid)
            if not participant:
                continue
            
            metrics["aggression"] += self._calc_aggression(participant)
            metrics["teamwork"] += self._calc_teamwork(participant)
            metrics["vision"] += self._calc_vision(participant)
            metrics["objective_focus"] += self._calc_objective_focus(participant)
            metrics["risk_taking"] += self._calc_risk_taking(participant)
        
        count = len(matches)
        return {k: v / count for k, v in metrics.items()} if count > 0 else metrics
    
    def get_champion_stats(self, matches: List[Dict], puuid: str) -> List[Dict]:
        """Extract top champions played"""
        champion_games = {}
        for match in matches:
            participant = self._find_participant(match, puuid)
            if participant:
                champ = participant.get('championName', 'Unknown')
                champion_games[champ] = champion_games.get(champ, 0) + 1
        
        return [{'name': k, 'games': v} for k, v in sorted(champion_games.items(), key=lambda x: x[1], reverse=True)]
    
    def _find_participant(self, match: Dict, puuid: str) -> Dict:
        """Find player's participant data in match"""
        for p in match.get("info", {}).get("participants", []):
            if p.get('puuid') == puuid:
                return p
        return None
    
    def _calc_aggression(self, p: Dict) -> float:
        """Aggression = kills + damage share - deaths penalty"""
        kills = p.get("kills", 0)
        deaths = p.get("deaths", 1)
        damage = p.get("totalDamageDealtToChampions", 0)
        return (kills * 2 + damage / 10000) / max(deaths, 1)
    
    def _calc_teamwork(self, p: Dict) -> float:
        """Teamwork = assists + team fight participation"""
        assists = p.get("assists", 0)
        participation = p.get("challenges", {}).get("teamDamagePercentage", 0)
        return assists * 0.5 + participation * 10
    
    def _calc_vision(self, p: Dict) -> float:
        """Vision control = wards placed + control wards"""
        wards = p.get("wardsPlaced", 0)
        control = p.get("visionWardsBoughtInGame", 0)
        return wards * 0.5 + control * 2
    
    def _calc_objective_focus(self, p: Dict) -> float:
        """Objective priority = dragon/baron/tower participation"""
        objectives = p.get("challenges", {}).get("epicMonsterSteals", 0)
        turrets = p.get("turretKills", 0)
        return objectives * 3 + turrets
    
    def _calc_risk_taking(self, p: Dict) -> float:
        """Risk = solo kills + early game aggression"""
        solo_kills = p.get("challenges", {}).get("soloKills", 0)
        early_deaths = p.get("challenges", {}).get("earlyLaningPhaseGoldExpAdvantage", 0)
        return solo_kills * 2 + early_deaths / 100

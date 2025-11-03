from typing import Dict

class RadarChart:
    """Generate personality radar chart data"""
    
    def generate_chart_data(self, metrics: Dict[str, float]) -> Dict:
        """Convert behavioral metrics to radar chart format"""
        
        # Normalize metrics to 0-100 scale
        normalized = {
            k: min(100, max(0, v * 10))
            for k, v in metrics.items()
        }
        
        return {
            "type": "radar",
            "labels": list(normalized.keys()),
            "values": list(normalized.values()),
            "title": "Playstyle Personality Radar"
        }
    
    def generate_html(self, metrics: Dict[str, float]) -> str:
        """Generate simple HTML visualization"""
        chart_data = self.generate_chart_data(metrics)
        
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <title>League MBTI Profile</title>
    <style>
        body {{ font-family: Arial; max-width: 800px; margin: 50px auto; }}
        .metric {{ margin: 10px 0; }}
        .bar {{ background: #4CAF50; height: 20px; }}
    </style>
</head>
<body>
    <h1>Your Playstyle Profile</h1>
"""
        
        for label, value in zip(chart_data["labels"], chart_data["values"]):
            html += f"""
    <div class="metric">
        <strong>{label.replace('_', ' ').title()}:</strong> {value:.1f}/100
        <div class="bar" style="width: {value}%"></div>
    </div>
"""
        
        html += """
</body>
</html>
"""
        return html

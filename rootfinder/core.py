"""
RootFinder Core Module
Policy Genealogy Tracking System
Author: Ignacio Adrian Lerer
Date: September 2025
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
from datetime import datetime
import networkx as nx
import json

@dataclass
class Policy:
    """Represents a single policy with genealogical information"""
    id: str
    name: str
    year_created: int
    year_terminated: Optional[int] = None
    parent_id: Optional[str] = None
    policy_type: str = ""
    government: str = ""
    ideology: str = ""
    components: Dict = field(default_factory=dict)
    
    @property
    def is_active(self) -> bool:
        return self.year_terminated is None
    
    @property
    def survival_years(self) -> int:
        end_year = self.year_terminated or datetime.now().year
        return end_year - self.year_created

@dataclass
class PolicyLineage:
    """Represents a policy's complete genealogical tree"""
    root_policy: Policy
    descendants: List[Policy] = field(default_factory=list)
    ancestors: List[Policy] = field(default_factory=list)
    siblings: List[Policy] = field(default_factory=list)
    inheritance_scores: Dict[str, float] = field(default_factory=dict)
    
    @property
    def total_descendants(self) -> int:
        return len(self.descendants)
    
    @property
    def mean_inheritance(self) -> float:
        if not self.inheritance_scores:
            return 0.0
        return np.mean(list(self.inheritance_scores.values()))
    
    @property
    def max_inheritance(self) -> float:
        if not self.inheritance_scores:
            return 0.0
        return max(self.inheritance_scores.values())

class PolicyGenealogy:
    """Main class for tracking policy genealogies"""
    
    def __init__(self):
        self.policies: Dict[str, Policy] = {}
        self.genealogy_graph = nx.DiGraph()
        self.corpus_loaded = False
        
    def load_corpus(self, filepath: str):
        """Load policy corpus from CSV file"""
        df = pd.read_csv(filepath)
        
        for _, row in df.iterrows():
            policy = Policy(
                id=row['policy_id'],
                name=row['policy_name'],
                year_created=row['year_created'],
                year_terminated=None if pd.isna(row['year_terminated']) else int(row['year_terminated']),
                parent_id=None if pd.isna(row['parent_policy']) else row['parent_policy'],
                policy_type=row['policy_type'],
                government=row['government'],
                ideology=row['ideological_orientation']
            )
            
            self.policies[policy.id] = policy
            self.genealogy_graph.add_node(policy.id, policy=policy)
            
            if policy.parent_id:
                self.genealogy_graph.add_edge(policy.parent_id, policy.id)
        
        self.corpus_loaded = True
        print(f"Loaded {len(self.policies)} policies")
        
    def trace_lineage(self, policy_id: str) -> PolicyLineage:
        """Trace complete lineage of a policy"""
        if policy_id not in self.policies:
            raise ValueError(f"Policy {policy_id} not found")
            
        policy = self.policies[policy_id]
        lineage = PolicyLineage(root_policy=policy)
        
        # Find ancestors
        ancestors = list(nx.ancestors(self.genealogy_graph, policy_id))
        lineage.ancestors = [self.policies[aid] for aid in ancestors]
        
        # Find descendants
        descendants = list(nx.descendants(self.genealogy_graph, policy_id))
        lineage.descendants = [self.policies[did] for did in descendants]
        
        # Find siblings (same parent)
        if policy.parent_id:
            siblings = [
                self.policies[nid] 
                for nid in self.genealogy_graph.successors(policy.parent_id)
                if nid != policy_id
            ]
            lineage.siblings = siblings
        
        # Calculate inheritance scores
        for descendant in lineage.descendants:
            score = self._calculate_inheritance(policy, descendant)
            lineage.inheritance_scores[descendant.id] = score
            
        return lineage
    
    def _calculate_inheritance(self, parent: Policy, descendant: Policy) -> float:
        """Calculate inheritance score between two policies"""
        score = 0.0
        
        # Temporal proximity (policies closer in time have higher inheritance)
        time_diff = abs(descendant.year_created - parent.year_created)
        temporal_score = max(0, 1 - time_diff / 50)  # 50 years = 0 score
        score += temporal_score * 0.3
        
        # Type similarity
        if parent.policy_type == descendant.policy_type:
            score += 0.3
            
        # Ideological alignment
        if parent.ideology == descendant.ideology:
            score += 0.3
            
        # Direct lineage bonus
        if descendant.parent_id == parent.id:
            score += 0.1
            
        return min(score, 1.0)
    
    def find_extended_phenotypes(self, threshold: float = 0.7) -> List[Policy]:
        """Identify policies that qualify as extended phenotypes"""
        extended_phenotypes = []
        
        for policy_id, policy in self.policies.items():
            score = self._calculate_phenotype_score(policy)
            if score >= threshold:
                extended_phenotypes.append(policy)
                
        return sorted(extended_phenotypes, 
                     key=lambda p: p.survival_years, 
                     reverse=True)
    
    def _calculate_phenotype_score(self, policy: Policy) -> float:
        """Calculate extended phenotype score for a policy"""
        lineage = self.trace_lineage(policy.id)
        
        # Environmental modification (measured by descendants)
        env_mod = min(lineage.total_descendants / 10, 1.0)
        
        # Persistence (survival years)
        persistence = min(policy.survival_years / 50, 1.0)
        
        # Heritability (mean inheritance score)
        heritability = lineage.mean_inheritance
        
        # Reproductive enhancement (simplified - based on ideology persistence)
        reproductive = 0.8 if policy.ideology == "Populist" else 0.3
        
        return (env_mod * 0.25 + 
                persistence * 0.25 + 
                heritability * 0.25 + 
                reproductive * 0.25)
    
    def export_genealogy(self, policy_id: str, format: str = "json") -> str:
        """Export policy genealogy in specified format"""
        lineage = self.trace_lineage(policy_id)
        
        if format == "json":
            data = {
                "root": {
                    "id": lineage.root_policy.id,
                    "name": lineage.root_policy.name,
                    "year": lineage.root_policy.year_created,
                    "survival_years": lineage.root_policy.survival_years
                },
                "ancestors": [
                    {"id": a.id, "name": a.name, "year": a.year_created}
                    for a in lineage.ancestors
                ],
                "descendants": [
                    {
                        "id": d.id, 
                        "name": d.name, 
                        "year": d.year_created,
                        "inheritance": lineage.inheritance_scores.get(d.id, 0)
                    }
                    for d in lineage.descendants
                ],
                "statistics": {
                    "total_descendants": lineage.total_descendants,
                    "mean_inheritance": lineage.mean_inheritance,
                    "max_inheritance": lineage.max_inheritance
                }
            }
            return json.dumps(data, indent=2)
        
        else:
            raise ValueError(f"Format {format} not supported")
    
    def visualize_genealogy(self, policy_id: str, output_file: str = None):
        """Create visualization of policy genealogy"""
        import matplotlib.pyplot as plt
        
        # Get subgraph for this policy's lineage
        lineage = self.trace_lineage(policy_id)
        nodes = [policy_id]
        nodes.extend([a.id for a in lineage.ancestors])
        nodes.extend([d.id for d in lineage.descendants])
        
        subgraph = self.genealogy_graph.subgraph(nodes)
        
        # Create layout
        pos = nx.spring_layout(subgraph, k=2, iterations=50)
        
        # Draw nodes
        node_colors = []
        for node in subgraph.nodes():
            policy = self.policies[node]
            if policy.ideology == "Populist":
                node_colors.append('red')
            elif policy.ideology == "Liberal":
                node_colors.append('blue')
            else:
                node_colors.append('gray')
        
        plt.figure(figsize=(12, 8))
        nx.draw(subgraph, pos, 
                node_color=node_colors,
                node_size=1000,
                with_labels=True,
                font_size=8,
                font_weight='bold',
                arrows=True,
                edge_color='gray',
                alpha=0.7)
        
        plt.title(f"Policy Genealogy: {self.policies[policy_id].name}")
        
        if output_file:
            plt.savefig(output_file, dpi=300, bbox_inches='tight')
        else:
            plt.show()
            
        plt.close()
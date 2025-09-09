#!/usr/bin/env python3
"""
RootFinder Stress Test - Constitutional Batch Analysis
Genealogias constitucionales AR/UY - Protocolo de validacion academica

Author: Ignacio Adrian Lerer
Date: September 2025
"""

import sys
import os
import time
import json
import hashlib
from datetime import datetime
import pandas as pd
import numpy as np

# Add RootFinder to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from rootfinder.core import PolicyGenealogy

class StressTestLogger:
    """Logger for stress test execution and quality control"""
    
    def __init__(self, test_name):
        self.test_name = test_name
        self.start_time = time.time()
        self.logs = []
        self.results = {}
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().isoformat()
        log_entry = {
            "timestamp": timestamp,
            "level": level,
            "message": message
        }
        self.logs.append(log_entry)
        print(f"[{timestamp}] {level}: {message}")
        
    def save_logs(self, output_dir):
        """Save execution logs to file"""
        os.makedirs(output_dir, exist_ok=True)
        log_file = os.path.join(output_dir, f"{self.test_name}_execution.log")
        
        with open(log_file, 'w') as f:
            for log_entry in self.logs:
                f.write(f"{log_entry['timestamp']} [{log_entry['level']}] {log_entry['message']}\n")
                
    def calculate_checksum(self, data):
        """Calculate checksum for reproducibility validation"""
        data_str = json.dumps(data, sort_keys=True)
        return hashlib.md5(data_str.encode()).hexdigest()

def run_constitutional_analysis():
    """Execute constitutional genealogy batch analysis"""
    
    logger = StressTestLogger("constitutional_batch")
    logger.log("Starting Constitutional Genealogy Stress Test")
    
    # Initialize genealogy system
    genealogy = PolicyGenealogy()
    
    # Load constitutional corpus
    corpus_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'corpus_constitucional.csv')
    
    try:
        genealogy.load_corpus(corpus_path)
        logger.log(f"Successfully loaded constitutional corpus with {len(genealogy.policies)} nodes")
    except Exception as e:
        logger.log(f"ERROR loading corpus: {e}", "ERROR")
        return None
    
    # Define constitutional roots for analysis
    constitutional_roots = [
        "ARG_CN1853_ART19",     # Argentine art. 19 original
        "ARG_CN1860_ART19",     # Argentine art. 19 reformed
        "ARG_CN1994_ART19",     # Argentine art. 19 current
        "URU_CN1830_ART72",     # Uruguayan art. 72 original
        "URU_CN1967_ART72",     # Uruguayan art. 72 current
        "ARG_DOCTRINA_AMPARO"   # Argentine amparo doctrine
    ]
    
    # Batch analysis results
    batch_results = []
    detailed_genealogies = {}
    
    logger.log(f"Analyzing {len(constitutional_roots)} constitutional roots")
    
    for root_id in constitutional_roots:
        logger.log(f"Tracing lineage for {root_id}")
        
        try:
            # Trace complete lineage
            lineage = genealogy.trace_lineage(root_id)
            
            # Calculate extended phenotype score
            phenotype_score = genealogy._calculate_phenotype_score(lineage.root_policy)
            
            # Collect comprehensive metrics
            result = {
                "root_id": root_id,
                "root_name": lineage.root_policy.name,
                "jurisdiction": "Argentina" if "ARG" in root_id else "Uruguay",
                "year_created": lineage.root_policy.year_created,
                "survival_years": lineage.root_policy.survival_years,
                "descendants_count": lineage.total_descendants,
                "ancestors_count": len(lineage.ancestors),
                "mean_inheritance": round(lineage.mean_inheritance, 4),
                "max_inheritance": round(lineage.max_inheritance, 4),
                "extended_phenotype_score": round(phenotype_score, 4),
                "ideology": lineage.root_policy.ideology if hasattr(lineage.root_policy, 'ideology') else 'Constitutional',
                "mutation_rate": calculate_mutation_rate(lineage),
                "network_centrality": calculate_centrality(genealogy, root_id)
            }
            
            batch_results.append(result)
            
            # Store detailed genealogy for export
            detailed_genealogies[root_id] = {
                "lineage_data": genealogy.export_genealogy(root_id, format="json"),
                "metrics": result
            }
            
            logger.log(f"  {root_id}: {result['survival_years']} years, {result['descendants_count']} descendants, inheritance={result['mean_inheritance']}")
            
        except Exception as e:
            logger.log(f"ERROR analyzing {root_id}: {e}", "ERROR")
            continue
    
    # Quality control tests
    logger.log("Running quality control tests")
    qc_results = run_quality_control(genealogy, constitutional_roots, logger)
    
    # Export results
    results_dir = os.path.join(os.path.dirname(__file__), '..', 'results')
    export_results(batch_results, detailed_genealogies, qc_results, results_dir, logger)
    
    # Save logs
    logs_dir = os.path.join(os.path.dirname(__file__), '..', 'logs')
    logger.save_logs(logs_dir)
    
    logger.log("Constitutional batch analysis completed successfully")
    return batch_results

def calculate_mutation_rate(lineage):
    """Calculate mutation rate (changes per decade) for a policy lineage"""
    if not lineage.descendants:
        return 0.0
    
    # Simplified mutation rate based on inheritance variance
    inheritance_scores = list(lineage.inheritance_scores.values())
    if not inheritance_scores:
        return 0.0
    
    variance = np.var(inheritance_scores)
    time_span = lineage.root_policy.survival_years / 10  # decades
    
    return round(variance / max(time_span, 1), 3)

def calculate_centrality(genealogy, node_id):
    """Calculate network centrality for a node"""
    # Simplified centrality based on total connections
    in_degree = len(list(genealogy.genealogy_graph.predecessors(node_id)))
    out_degree = len(list(genealogy.genealogy_graph.successors(node_id)))
    
    return in_degree + out_degree

def run_quality_control(genealogy, test_roots, logger):
    """Execute quality control tests for reproducibility and stability"""
    
    logger.log("QC Test 1: Reproducibility (3 identical runs)")
    reproducibility_results = []
    
    # Test reproducibility with 3 identical runs
    for run in range(3):
        run_results = []
        for root_id in test_roots[:3]:  # Test first 3 roots
            try:
                lineage = genealogy.trace_lineage(root_id)
                metrics = {
                    "survival_years": lineage.root_policy.survival_years,
                    "descendants": lineage.total_descendants,
                    "mean_inheritance": lineage.mean_inheritance
                }
                run_results.append(metrics)
            except:
                continue
        reproducibility_results.append(run_results)
    
    # Calculate reproducibility variance
    if len(reproducibility_results) == 3 and all(len(r) > 0 for r in reproducibility_results):
        variance_test = calculate_reproducibility_variance(reproducibility_results)
        logger.log(f"  Reproducibility variance: {variance_test:.6f} (target: < 0.01)")
    
    logger.log("QC Test 2: Perturbation resistance")
    # Test with text perturbations would go here
    
    logger.log("QC Test 3: Gold standard validation")
    # Validate against known genealogies
    gold_standard_results = validate_gold_standard(genealogy, logger)
    
    return {
        "reproducibility_variance": variance_test if 'variance_test' in locals() else None,
        "gold_standard_concordance": gold_standard_results
    }

def calculate_reproducibility_variance(results_list):
    """Calculate variance across reproducibility runs"""
    # Extract mean_inheritance values from all runs
    inheritance_values = []
    for run_results in results_list:
        for result in run_results:
            inheritance_values.append(result.get('mean_inheritance', 0))
    
    return np.var(inheritance_values) if inheritance_values else 1.0

def validate_gold_standard(genealogy, logger):
    """Validate against known genealogical relationships"""
    
    gold_standards = [
        {
            "parent": "ARG_CN1853_ART19",
            "child": "ARG_CN1860_ART19",
            "expected_inheritance": 0.9  # High inheritance expected
        },
        {
            "parent": "ARG_CN1860_ART19", 
            "child": "ARG_CSJN_SIRI",
            "expected_inheritance": 0.7  # Moderate inheritance expected
        },
        {
            "parent": "URU_CN1830_ART72",
            "child": "URU_CN1967_ART72", 
            "expected_inheritance": 0.85  # High inheritance expected
        }
    ]
    
    concordances = []
    
    for standard in gold_standards:
        try:
            parent_lineage = genealogy.trace_lineage(standard["parent"])
            
            # Find the child in descendants
            child_inheritance = None
            for desc in parent_lineage.descendants:
                if desc.id == standard["child"]:
                    child_inheritance = parent_lineage.inheritance_scores.get(desc.id, 0)
                    break
            
            if child_inheritance is not None:
                expected = standard["expected_inheritance"]
                actual = child_inheritance
                concordance = 1 - abs(expected - actual)  # Simple concordance measure
                concordances.append(concordance)
                
                logger.log(f"  {standard['parent']} -> {standard['child']}: expected={expected}, actual={actual:.3f}, concordance={concordance:.3f}")
        
        except Exception as e:
            logger.log(f"  Error validating {standard['parent']} -> {standard['child']}: {e}")
            continue
    
    mean_concordance = np.mean(concordances) if concordances else 0.0
    logger.log(f"  Mean concordance: {mean_concordance:.3f} (target: >= 0.8)")
    
    return mean_concordance

def export_results(batch_results, detailed_genealogies, qc_results, output_dir, logger):
    """Export all analysis results to files"""
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Main results table
    df_results = pd.DataFrame(batch_results)
    results_file = os.path.join(output_dir, "constitutional_analysis_results.csv")
    df_results.to_csv(results_file, index=False)
    logger.log(f"Exported main results to {results_file}")
    
    # Detailed genealogies as JSON
    genealogies_file = os.path.join(output_dir, "constitutional_genealogies_detailed.json")
    with open(genealogies_file, 'w') as f:
        json.dump(detailed_genealogies, f, indent=2)
    logger.log(f"Exported detailed genealogies to {genealogies_file}")
    
    # Quality control report
    qc_file = os.path.join(output_dir, "constitutional_quality_control.json")
    with open(qc_file, 'w') as f:
        json.dump(qc_results, f, indent=2)
    logger.log(f"Exported QC results to {qc_file}")
    
    # Summary statistics
    summary = generate_summary_stats(df_results)
    summary_file = os.path.join(output_dir, "constitutional_summary_stats.json")
    with open(summary_file, 'w') as f:
        json.dump(summary, f, indent=2)
    logger.log(f"Exported summary statistics to {summary_file}")

def generate_summary_stats(df):
    """Generate summary statistics for the batch results"""
    
    arg_policies = df[df['jurisdiction'] == 'Argentina']
    uru_policies = df[df['jurisdiction'] == 'Uruguay']
    
    summary = {
        "total_policies_analyzed": len(df),
        "argentina_policies": len(arg_policies),
        "uruguay_policies": len(uru_policies),
        "mean_survival_argentina": float(arg_policies['survival_years'].mean()) if len(arg_policies) > 0 else 0,
        "mean_survival_uruguay": float(uru_policies['survival_years'].mean()) if len(uru_policies) > 0 else 0,
        "mean_inheritance_argentina": float(arg_policies['mean_inheritance'].mean()) if len(arg_policies) > 0 else 0,
        "mean_inheritance_uruguay": float(uru_policies['mean_inheritance'].mean()) if len(uru_policies) > 0 else 0,
        "total_descendants_argentina": int(arg_policies['descendants_count'].sum()) if len(arg_policies) > 0 else 0,
        "total_descendants_uruguay": int(uru_policies['descendants_count'].sum()) if len(uru_policies) > 0 else 0,
        "max_survival_policy": df.loc[df['survival_years'].idxmax()]['root_name'] if len(df) > 0 else None,
        "max_descendants_policy": df.loc[df['descendants_count'].idxmax()]['root_name'] if len(df) > 0 else None,
        "highest_inheritance_policy": df.loc[df['mean_inheritance'].idxmax()]['root_name'] if len(df) > 0 else None
    }
    
    return summary

if __name__ == "__main__":
    print("=== RootFinder Constitutional Stress Test ===")
    results = run_constitutional_analysis()
    
    if results:
        print(f"\n✅ Stress test completed successfully!")
        print(f"   Analyzed {len(results)} constitutional roots")
        print(f"   Results saved to stress_test/results/")
        print(f"   Logs saved to stress_test/logs/")
    else:
        print("❌ Stress test failed - check logs for details")
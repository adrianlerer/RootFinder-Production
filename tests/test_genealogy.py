"""
Test suite for RootFinder genealogy tracking
Author: Ignacio Adrian Lerer
Date: September 2025
"""

import pytest
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from rootfinder import PolicyGenealogy, Policy
import tempfile
import pandas as pd

@pytest.fixture
def sample_data():
    """Create sample policy data for testing"""
    return pd.DataFrame([
        {
            'policy_id': 'POL001',
            'policy_name': 'Test Policy 1',
            'year_created': 2000,
            'year_terminated': None,
            'parent_policy': None,
            'policy_type': 'Economic',
            'government': 'Test Gov',
            'survival_years': 25,
            'descendants_count': 2,
            'ideological_orientation': 'Populist'
        },
        {
            'policy_id': 'POL002', 
            'policy_name': 'Test Policy 2',
            'year_created': 2010,
            'year_terminated': 2020,
            'parent_policy': 'POL001',
            'policy_type': 'Economic',
            'government': 'Test Gov 2',
            'survival_years': 10,
            'descendants_count': 0,
            'ideological_orientation': 'Liberal'
        }
    ])

def test_policy_creation():
    """Test Policy dataclass creation and properties"""
    policy = Policy(
        id="TEST001",
        name="Test Policy",
        year_created=2000,
        year_terminated=2010,
        ideology="Populist"
    )
    
    assert policy.id == "TEST001"
    assert policy.survival_years == 10
    assert not policy.is_active

def test_load_corpus(sample_data):
    """Test loading policy corpus from CSV"""
    genealogy = PolicyGenealogy()
    
    # Create temporary CSV file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        sample_data.to_csv(f.name, index=False)
        temp_path = f.name
    
    try:
        genealogy.load_corpus(temp_path)
        assert len(genealogy.policies) == 2
        assert "POL001" in genealogy.policies
        assert genealogy.corpus_loaded
    finally:
        os.unlink(temp_path)

def test_trace_lineage(sample_data):
    """Test tracing policy lineage"""
    genealogy = PolicyGenealogy()
    
    # Create temporary CSV file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        sample_data.to_csv(f.name, index=False)
        temp_path = f.name
    
    try:
        genealogy.load_corpus(temp_path)
        lineage = genealogy.trace_lineage("POL001")
        
        assert lineage.root_policy.id == "POL001"
        assert len(lineage.descendants) == 1
        assert lineage.descendants[0].id == "POL002"
    finally:
        os.unlink(temp_path)

def test_extended_phenotypes(sample_data):
    """Test extended phenotype identification"""
    genealogy = PolicyGenealogy()
    
    # Create temporary CSV file  
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        sample_data.to_csv(f.name, index=False)
        temp_path = f.name
    
    try:
        genealogy.load_corpus(temp_path)
        phenotypes = genealogy.find_extended_phenotypes(threshold=0.0)
        
        assert len(phenotypes) >= 1
        assert phenotypes[0].id in genealogy.policies
    finally:
        os.unlink(temp_path)

def test_export_genealogy(sample_data):
    """Test genealogy export functionality"""
    genealogy = PolicyGenealogy()
    
    # Create temporary CSV file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        sample_data.to_csv(f.name, index=False)
        temp_path = f.name
    
    try:
        genealogy.load_corpus(temp_path)
        json_output = genealogy.export_genealogy("POL001")
        
        assert isinstance(json_output, str)
        assert "POL001" in json_output
        assert "descendants" in json_output
    finally:
        os.unlink(temp_path)
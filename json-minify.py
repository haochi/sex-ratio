#!/usr/bin/env python
import json
import sys
import glob
import os.path

for file_name in glob.glob(sys.argv[1]):
    with open(file_name) as in_file:
        with open(os.path.join(sys.argv[2], os.path.basename(file_name)), 'w') as out_file:
            json.dump(json.load(in_file), out_file, separators=(',', ':'))

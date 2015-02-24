mockExplainOther = {
  'l514':{
    match:false,
    value:0.0,
    description:'no matching term'},
  'l71': {
    match: false,
    value: 0.0,
    description: 'no matching term'},
  'l19254':{
    match: true,
    value: 3.3733945,
    description:'weight(catch_line:law in 4487) [DefaultSimilarity], result of:',
    details: [{
        match: true,
        value:3.3733945,
        description: 'fieldWeight in 4487, product of:',
        details :[{
            match: true,
            value: 1.0,
            description: 'tf(freq=1.0), with freq of:',
            details:[{
                match: true,
                value: 1.0,
                description:'termFreq=1.0'}]},
          {
            match: true,
            value: 5.3974314,
            description: 'idf(docFreq=247, maxDocs=20148)'},
          {
            match: true,
            value: 0.625,
            description: 'fieldNorm(doc=4487)'}]}]}};

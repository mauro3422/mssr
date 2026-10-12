param([switch]$RefreshDraft)
$rootRel='experiments/jev-mssr-live/runs/mssr-librarian-official-doc-generalization-20261012T0252Z-v1'
$root=Join-Path (Get-Location) $rootRel
$sourceDir=Join-Path $root 'inputs/sources'
$previousDir='experiments/jev-mssr-live/runs/mssr-librarian-answerability-dev-20261012T0210Z-v2'
$bridgeRoot='D:\Dev\bridge-mcp-mssr-0.2.112-query-variants'
$manifestPath=Join-Path $root 'manifest.json'
if(Test-Path -LiteralPath $manifestPath){
  if(-not $RefreshDraft){throw 'manifest already exists; pass -RefreshDraft only before any provider output exists'}
  foreach($output in @('request-events.jsonl','records.jsonl','summary.json','run-completion.json','SHA256SUMS')){
    if(Test-Path -LiteralPath (Join-Path $root $output)){throw "provider output exists; refusing to replace frozen packet: $output"}
  }
}
$expected=@(
'01-typescript-narrowing.md','02-typescript-everyday-types.md','03-rust-refcell.md','04-rust-mutex.md',
'05-node-fs.md','06-node-process.md','07-github-workflow-syntax.md','08-github-managing-labels.md'
)
$actual=@(Get-ChildItem -LiteralPath $sourceDir -File | ForEach-Object Name | Sort-Object)
if(($actual -join '|') -ne (($expected | Sort-Object) -join '|')){throw 'source snapshot set differs from the audited eight files'}
$prior=Get-Content -LiteralPath (Join-Path $previousDir 'manifest.json') -Raw | ConvertFrom-Json
$caseData=@(
@{id='typescript-narrowing-pos';file='01-typescript-narrowing.md';family='microsoft/TypeScript-Website';commit='6556b08756b766fd41d0f887174cb0b042e5f72c';upstreamPath='packages/documentation/copy/en/handbook-v2/Narrowing.md';query='What common property with literal types lets TypeScript narrow a discriminated union?';kind='positive';heading='Discriminated unions';start=658;end=658;rationale='Line 658 directly defines the common property with literal types and its narrowing effect.'}
@{id='typescript-narrowing-neg';file='01-typescript-narrowing.md';family='microsoft/TypeScript-Website';commit='6556b08756b766fd41d0f887174cb0b042e5f72c';upstreamPath='packages/documentation/copy/en/handbook-v2/Narrowing.md';query='What is the maximum number of variants TypeScript can distinguish in a discriminated union?';kind='negative';rationale='The document explains narrowing with examples but does not specify a maximum variant count.'}
@{id='typescript-everyday-pos';file='02-typescript-everyday-types.md';family='microsoft/TypeScript-Website';commit='6556b08756b766fd41d0f887174cb0b042e5f72c';upstreamPath='packages/documentation/copy/en/handbook-v2/Everyday Types.md';query='Which two equivalent syntaxes does the handbook give for a numeric array?';kind='positive';heading='Arrays';start=31;end=32;rationale='Lines 31-32 give number[] and Array<number> as equivalent numeric-array syntax.'}
@{id='typescript-everyday-neg';file='02-typescript-everyday-types.md';family='microsoft/TypeScript-Website';commit='6556b08756b766fd41d0f887174cb0b042e5f72c';upstreamPath='packages/documentation/copy/en/handbook-v2/Everyday Types.md';query='In which TypeScript version were type aliases introduced?';kind='negative';rationale='The Type Aliases section defines the construct but does not give an introduction version.'}
@{id='rust-refcell-pos';file='03-rust-refcell.md';family='rust-lang/book';commit='1500248d8f230566e4ec9f27fcbb8fe9e2898ab1';upstreamPath='src/ch15-05-interior-mutability.md';query='When does RefCell enforce borrowing rules, and what happens if they are broken?';kind='positive';heading='Enforcing Borrowing Rules at Runtime';start=34;end=36;rationale='Lines 34-36 say RefCell checks at runtime and panics and exits if borrowing rules are broken.'}
@{id='rust-refcell-neg';file='03-rust-refcell.md';family='rust-lang/book';commit='1500248d8f230566e4ec9f27fcbb8fe9e2898ab1';upstreamPath='src/ch15-05-interior-mutability.md';query='What exact percentage of runtime overhead does RefCell add compared with ordinary references?';kind='negative';rationale='The document describes a small runtime cost but gives no exact percentage.'}
@{id='rust-mutex-pos';file='04-rust-mutex.md';family='rust-lang/book';commit='1500248d8f230566e4ec9f27fcbb8fe9e2898ab1';upstreamPath='src/ch16-03-shared-state.md';query='What two rules should be followed when using data protected by a Mutex?';kind='positive';heading='Controlling Access with Mutexes';start=37;end=39;rationale='Lines 37-39 list acquiring the lock before use and unlocking when done.'}
@{id='rust-mutex-neg';file='04-rust-mutex.md';family='rust-lang/book';commit='1500248d8f230566e4ec9f27fcbb8fe9e2898ab1';upstreamPath='src/ch16-03-shared-state.md';query='Does Mutex guarantee FIFO lock acquisition order?';kind='negative';rationale='The inspected source describes lock and guard behavior but does not promise FIFO fairness.'}
@{id='node-fs-pos';file='05-node-fs.md';family='nodejs/node';commit='3b639be3a4dd88f81d33d4c375c8af3cfc8fe695';upstreamPath='doc/api/fs.md';query='Why should streaming be preferred over fs.readFile when minimizing memory costs?';kind='positive';heading='fs.readFile(path[, options], callback)';start=4543;end=4544;rationale='Lines 4543-4544 explain that fs.readFile buffers the whole file and recommend streaming to minimize memory cost.'}
@{id='node-fs-neg';file='05-node-fs.md';family='nodejs/node';commit='3b639be3a4dd88f81d33d4c375c8af3cfc8fe695';upstreamPath='doc/api/fs.md';query='How many milliseconds per million operations do fs callbacks save over promises?';kind='negative';rationale='The API documentation gives no such benchmark measurement.'}
@{id='node-process-pos';file='06-node-process.md';family='nodejs/node';commit='3b639be3a4dd88f81d33d4c375c8af3cfc8fe695';upstreamPath='doc/api/process.md';query='What should code set instead of calling process.exit() to let the process exit naturally?';kind='positive';heading='process.exit([code])';start=1821;end=1823;rationale='Lines 1821-1823 recommend setting process.exitCode and allowing natural exit.'}
@{id='node-process-neg';file='06-node-process.md';family='nodejs/node';commit='3b639be3a4dd88f81d33d4c375c8af3cfc8fe695';upstreamPath='doc/api/process.md';query='At what interval does process.cpuUsage internally update its counters?';kind='negative';rationale='The process.cpuUsage documentation does not state an internal update interval.'}
@{id='github-workflow-pos';file='07-github-workflow-syntax.md';family='github/docs';commit='be38ec5d78e24172587e61b3c6ff40ace1865c71';upstreamPath='content/actions/reference/workflows-and-actions/workflow-syntax.md';query='In what order are GITHUB_TOKEN defaults and workflow/job permissions adjusted, and what happens to write permissions for fork pull requests?';kind='positive';heading='How permissions are calculated for a workflow job';start=354;end=354;rationale='Line 354 states defaults first, then workflow-level and job-level changes, followed by write-to-read reduction for qualifying fork pull requests unless the send-write-tokens setting is enabled.'}
@{id='github-workflow-neg';file='07-github-workflow-syntax.md';family='github/docs';commit='be38ec5d78e24172587e61b3c6ff40ace1865c71';upstreamPath='content/actions/reference/workflows-and-actions/workflow-syntax.md';query='What maximum time does GitHub guarantee for a queued workflow to start?';kind='negative';rationale='The workflow syntax reference does not provide a queue-start service guarantee.'}
@{id='github-labels-pos';file='08-github-labels-pos';family='github/docs';commit='be38ec5d78e24172587e61b3c6ff40ace1865c71';upstreamPath='content/issues/using-labels-and-milestones-to-track-work/managing-labels.md';query='What default labels can organization owners customize for their repositories?';kind='positive';heading='About default labels';start=56;end=56;rationale='Line 56 says organization owners can customize the default labels for repositories in their organization.'}
@{id='github-labels-neg';file='08-github-managing-labels.md';family='github/docs';commit='be38ec5d78e24172587e61b3c6ff40ace1865c71';upstreamPath='content/issues/using-labels-and-milestones-to-track-work/managing-labels.md';query='What is the maximum number of custom labels a repository can have?';kind='negative';rationale='The guide covers label creation and management but does not state a repository label quota.'}
)
# Correct the positive GitHub labels filename to the checked snapshot name.
$caseData[14].file='08-github-managing-labels.md'
$cases=[System.Collections.Generic.List[object]]::new()
$labels=[System.Collections.Generic.List[object]]::new()
$sources=[System.Collections.Generic.List[object]]::new()
$inventory=[System.Collections.Generic.List[object]]::new()
$now=[DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
foreach($item in $caseData){
  $sourceRef=$rootRel.Replace('\','/')+'/inputs/sources/'+$item.file
  $snapshotPath='inputs/sources/'+$item.file
  $sourcePath=Join-Path $root ($snapshotPath.Replace('/',[IO.Path]::DirectorySeparatorChar))
  $sha=(Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLower()
  $upstreamPathUrl=[Uri]::EscapeDataString($item.upstreamPath).Replace('%2F','/')
  $blobUrl='https://github.com/'+$item.family+'/blob/'+$item.commit+'/'+$upstreamPathUrl
  $rawUrl='https://raw.githubusercontent.com/'+$item.family+'/'+$item.commit+'/'+$upstreamPathUrl
  if(-not ($sources | Where-Object sourceRef -eq $sourceRef)){
    $src=[pscustomobject][ordered]@{sourceRef=$sourceRef;sha256=$sha;snapshotPath=$snapshotPath;sourceFamily=$item.family;sourceRevision=$item.commit;upstreamPath=$item.upstreamPath;upstreamUrl=$blobUrl;rawSnapshotUrl=$rawUrl}
    $sources.Add($src)
    $inventory.Add([pscustomobject][ordered]@{sourceRef=$sourceRef;repository=$item.family;commit=$item.commit;upstreamPath=$item.upstreamPath;upstreamUrl=$blobUrl;snapshotPath=$snapshotPath;sha256=$sha;bytes=(Get-Item -LiteralPath $sourcePath).Length})
  }
  $cases.Add([pscustomobject][ordered]@{id=$item.id;sourceRef=$sourceRef;sourceCluster=$item.family;language='en';query=$item.query})
  if($item.kind -eq 'positive'){
    $relevantStart=$item.start;$relevantEnd=$item.end
    if($item.id -eq 'rust-mutex-pos'){$relevantStart=34;$relevantEnd=39}
    $range=[pscustomobject][ordered]@{sourceRef=$sourceRef;expectedHeading=$item.heading;startLine=$item.start;endLine=$item.end}
    $relevant=[pscustomobject][ordered]@{sourceRef=$sourceRef;expectedHeading=$item.heading;startLine=$relevantStart;endLine=$relevantEnd}
    $labels.Add([pscustomobject][ordered]@{caseId=$item.id;sourceRef=$sourceRef;answerability='answerable';expectedHeading=$item.heading;expectedStartLine=$item.start;expectedEndLine=$item.end;acceptableRanges=@($range);rationale=$item.rationale;relevantRanges=@($relevant)})
  } else {
    $labels.Add([pscustomobject][ordered]@{caseId=$item.id;sourceRef=$sourceRef;answerability='unanswerable';rationale=$item.rationale})
  }
}
function Write-Utf8NoBom([string]$Path,[string]$Text){[IO.File]::WriteAllText($Path,$Text,[Text.UTF8Encoding]::new($false))}
function Write-Json([string]$Path,$Value){Write-Utf8NoBom $Path (($Value | ConvertTo-Json -Depth 40)+[Environment]::NewLine)}
function Set-Field($Target,[string]$Name,$Value){$Target | Add-Member -NotePropertyName $Name -NotePropertyValue $Value -Force}
$casesFile=Join-Path $root 'inputs/cases.json'
$labelsFile=Join-Path $root 'inputs/labels.json'
$corpusFile=Join-Path $root 'inputs/corpus.jsonl'
Write-Json $casesFile ([pscustomobject][ordered]@{schemaVersion=1;cases=@($cases.ToArray())})
Write-Json $labelsFile ([pscustomobject][ordered]@{source='independent-review';adjudication='two separate Luna reviewers assessed answerability; an independent reviewer checked the positive claims; the coordinator revalidated all cited line positions against SHA-256-pinned raw Markdown; model-assisted, not human or owner-gold';frozenAt=$now;cases=@($labels.ToArray());scoringPolicy='Answerable cases require a selected exact or explicitly relevant same-source range; unanswerable cases require abstention. Exact accepted range, broader relevant range, search recall, fetch validity, and evidence-pack validity are reported separately. Choice confidence and Noul are descriptive and uncalibrated.'})
$inventoryLines=@($inventory.ToArray() | ForEach-Object { $_ | ConvertTo-Json -Compress -Depth 12 })
Write-Utf8NoBom $corpusFile (($inventoryLines -join [Environment]::NewLine)+[Environment]::NewLine)
$docsPath=Join-Path $root 'inputs/build'
New-Item -ItemType Directory -Path $docsPath -Force | Out-Null
$buildArtifacts=@()
foreach($artifact in $prior.source.buildArtifacts){
  $sourceArtifact=Join-Path $bridgeRoot ($artifact.path.Replace('/',[IO.Path]::DirectorySeparatorChar))
  if(-not (Test-Path -LiteralPath $sourceArtifact -PathType Leaf)){throw "missing Bridge release artifact: $($artifact.path)"}
  $currentHash=(Get-FileHash -LiteralPath $sourceArtifact -Algorithm SHA256).Hash.ToLower()
  if($currentHash -ne $artifact.sha256.ToLower()){throw "Bridge release artifact differs from Run35: $($artifact.path)"}
  $snapshotPath='inputs/build/'+$artifact.path
  $destination=Join-Path $root ($snapshotPath.Replace('/',[IO.Path]::DirectorySeparatorChar))
  $parent=Split-Path -Parent $destination
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  Copy-Item -LiteralPath $sourceArtifact -Destination $destination
  $copiedHash=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLower()
  if($copiedHash -ne $artifact.sha256.ToLower()){throw "copied Bridge artifact hash mismatch: $($artifact.path)"}
  $buildArtifacts+=,[pscustomobject][ordered]@{path=$artifact.path;sha256=$artifact.sha256.ToLower();snapshotPath=$snapshotPath}
}
foreach($name in @('runner.mjs','selection-record.mjs','runner-support.mjs')){
  $source=Join-Path $previousDir $name
  $destination=Join-Path $root $name
  Copy-Item -LiteralPath $source -Destination $destination -Force
}
$runnerHash=(Get-FileHash -LiteralPath (Join-Path $root 'runner.mjs') -Algorithm SHA256).Hash.ToLower()
$selectionHash=(Get-FileHash -LiteralPath (Join-Path $root 'selection-record.mjs') -Algorithm SHA256).Hash.ToLower()
$supportHash=(Get-FileHash -LiteralPath (Join-Path $root 'runner-support.mjs') -Algorithm SHA256).Hash.ToLower()
$casesHash=(Get-FileHash -LiteralPath $casesFile -Algorithm SHA256).Hash.ToLower()
$labelsHash=(Get-FileHash -LiteralPath $labelsFile -Algorithm SHA256).Hash.ToLower()
$corpusHash=(Get-FileHash -LiteralPath $corpusFile -Algorithm SHA256).Hash.ToLower()
$gitCommit=(git rev-parse HEAD).Trim()
$node=(node --version).Trim()
$manifest=$prior
$manifest.runId=(Split-Path -Leaf $root)
$manifest.createdAt=$now
$manifest.status='prepared'
$manifest.study='official-public-document-generalization-answerability-and-evidence-range-selection'
$manifest.source | Add-Member -NotePropertyName repository -NotePropertyValue 'MSSR' -Force
$manifest.source | Add-Member -NotePropertyName gitCommit -NotePropertyValue $gitCommit -Force
$manifest.source | Add-Member -NotePropertyName workingTreeClean -NotePropertyValue $false -Force
$manifest.source | Add-Member -NotePropertyName changedPaths -NotePropertyValue @($rootRel) -Force
$manifest.source | Add-Member -NotePropertyName buildId -NotePropertyValue 'Bridge 0.6.172; MSSR 0.2.127; Jev 1.13.0' -Force
$manifest.source.bridgeRoot=$bridgeRoot
$manifest.source.buildArtifacts=@($buildArtifacts)
$manifest.corpus.projectRoot=(Get-Location).Path
$manifest.corpus.sources=@($sources.ToArray())
$manifest.corpus | Add-Member -NotePropertyName inventoryPath -NotePropertyValue 'inputs/corpus.jsonl' -Force
$manifest.corpus | Add-Member -NotePropertyName sha256 -NotePropertyValue $corpusHash -Force
$manifest.corpus | Add-Member -NotePropertyName items -NotePropertyValue $sources.Count -Force
$manifest.corpus | Add-Member -NotePropertyName sourceRevision -NotePropertyValue 'Four pinned upstream Git commits, recorded per source in inputs/corpus.jsonl.' -Force
$manifest.corpus | Add-Member -NotePropertyName redaction -NotePropertyValue 'not-applicable; public official documentation' -Force
$manifest.provider.provider='typesafe-jev'
$manifest.provider | Add-Member -NotePropertyName endpointIdentity -NotePropertyValue 'https://api.typesafe.ai' -Force
$manifest.provider.requestedModel='jev-1.13.0'
$manifest.provider | Add-Member -NotePropertyName sdk -NotePropertyValue '@typesafe-ai/sdk@0.6.0' -Force
$manifest.provider.mode='live'
$manifest.provider | Add-Member -NotePropertyName timeoutMs -NotePropertyValue 30000 -Force
$manifest.provider | Add-Member -NotePropertyName maxRetries -NotePropertyValue 1 -Force
$manifest.provider | Add-Member -NotePropertyName concurrency -NotePropertyValue 1 -Force
$manifest.provider.networkOptIn=$true
$manifest.provider.networkOptInMethod='explicit command-line --allow-network plus user authorization recorded in manifest'
$manifest.plan.expectedRequestCount=$cases.Count
$manifest.plan.independentUnit='four upstream repository families; two documents per family; positive/negative pair within each document is linked'
$manifest.plan.labelsPreparedBeforeProviderCalls=$true
$manifest.plan.ownerGold=$false
$manifest.plan | Add-Member -NotePropertyName intendedLanguageBalance -NotePropertyValue ([pscustomobject][ordered]@{positiveEnglish=8;positiveSpanish=0;negativeEnglish=8;negativeSpanish=0}) -Force
$manifest.plan | Add-Member -NotePropertyName primaryMetric -NotePropertyValue 'answerability disposition: positive selects an exact or predeclared relevant source range; negative abstains; report valid decisions and failed attempts separately' -Force
$manifest.plan | Add-Member -NotePropertyName secondaryMetrics -NotePropertyValue @('exact accepted range among positives','predeclared relevant range among positives','answerable target range present in search results','verified exact fetch count','validated verbatim evidence-pack count','false selections on negatives','abstentions on positives','provider failures/retries/latency/token usage','raw Choice confidence/probabilities and Noul, descriptive only') -Force
$manifest.plan | Add-Member -NotePropertyName minimumSupport -NotePropertyValue ([pscustomobject][ordered]@{overall=30;perClaimedSubgroup=30}) -Force
$manifest.plan | Add-Member -NotePropertyName uncertaintyMethod -NotePropertyValue 'Not estimated for inferential claims; only four repository-family clusters, below the predeclared minimum support, so descriptive exploratory counts only.' -Force
$manifest.plan | Add-Member -NotePropertyName queryVariants -NotePropertyValue 'None; English source text and English queries. Earlier runs cover multilingual query behavior.' -Force
$manifest | Add-Member -NotePropertyName split -NotePropertyValue ([pscustomobject][ordered]@{method='none';trainIdsSha256=$null;validationIdsSha256=$null;holdoutIdsSha256=$null;holdoutOpenedAt=$null;holdoutUsedForTuning=$false}) -Force
$manifest.labels.source='independent-review'
$manifest.labels | Add-Member -NotePropertyName frozenAt -NotePropertyValue $now -Force
$manifest.labels.adjudication='independent model-assisted review with exact source-position revalidation; not human or owner-gold'
$manifest.labels | Add-Member -NotePropertyName labelFile -NotePropertyValue 'inputs/labels.json' -Force
$manifest.labels.labelFileSha256=$labelsHash
$manifest.labels | Add-Member -NotePropertyName exposedToRequests -NotePropertyValue $false -Force
$manifest.instrument | Add-Member -NotePropertyName runnerPath -NotePropertyValue 'runner.mjs' -Force
$manifest.instrument.runnerSha256=$runnerHash
$manifest.instrument | Add-Member -NotePropertyName selectionRecordPath -NotePropertyValue 'selection-record.mjs' -Force
$manifest.instrument.selectionRecordSha256=$selectionHash
$manifest.instrument | Add-Member -NotePropertyName runnerSupportPath -NotePropertyValue 'runner-support.mjs' -Force
$manifest.instrument.runnerSupportSha256=$supportHash
$manifest.instrument | Add-Member -NotePropertyName casesPath -NotePropertyValue 'inputs/cases.json' -Force
$manifest.instrument.casesSha256=$casesHash
$manifest.instrument | Add-Member -NotePropertyName corpusInventorySha256 -NotePropertyValue $corpusHash -Force
$manifest.instrument | Add-Member -NotePropertyName preparationScriptPath -NotePropertyValue 'prepare-run.ps1' -Force
$manifest.instrument | Add-Member -NotePropertyName lockfileSha256 -NotePropertyValue $null -Force
$manifest.instrument | Add-Member -NotePropertyName runtime -NotePropertyValue "node $node" -Force
$manifest.instrument | Add-Member -NotePropertyName requestSchemaVersion -NotePropertyValue 1 -Force
$manifest.traceId='mssr-codex-jev-official-doc-generalization-20261012'
Write-Json $manifestPath $manifest
$review=@"
# Public official-doc cohort review

This run checks whether the MSSR Librarian pipeline generalizes to eight pinned public Markdown files from Microsoft TypeScript documentation, the Rust Book, Node.js documentation, and GitHub Docs. Each document has one answerable and one source-scoped unanswerable query. The two queries per document are linked; the primary clustering unit is the upstream repository family (four clusters, two files each).

The positive answer claims were independently reviewed by a Luna reviewer and their exact line locations were rechecked against the downloaded snapshots. A separate Luna reviewer proposed and checked the unanswerable cases against only the scoped source. All eight raw snapshots were hash-verified against their pinned upstream revisions. Labels are model-assisted independent review, not human or owner-gold.

The cohort is all English to focus on source-family generalization. Earlier MSSR experiments already exercised English/Spanish queries. The evaluation tests lexical candidate retrieval, Jev selection/abstention, exact fetch and evidence-pack integrity. It does not test atom metadata, synthesis preview, or host-written paragraph composition. The last is host-owned and must be evaluated separately.

The run uses the verified isolated Bridge release module (Bridge 0.6.172 / MSSR 0.2.127 / Jev 1.13.0), not the active MCP connector. Run 34 separately checked active-connector parity on three cases. This 16-request run is exploratory: four repository clusters are below the protocol support floor of 30 independent units. No confidence calibration, production threshold, reliability, or superiority claim follows from it.
"@
[IO.File]::WriteAllText((Join-Path $root 'COHORT-REVIEW.md'),$review,[Text.UTF8Encoding]::new($false))
$prepPath=Join-Path $root 'prepare-run.ps1'
$prepHash=(Get-FileHash -LiteralPath $prepPath -Algorithm SHA256).Hash.ToLower()
$manifest=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$manifest.instrument | Add-Member -NotePropertyName preparationScriptSha256 -NotePropertyValue $prepHash -Force
Write-Json $manifestPath $manifest
"Prepared $($manifest.runId): $($cases.Count) cases, $($sources.Count) sources, $($buildArtifacts.Count) Bridge artifacts."
"Manifest SHA256: $((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLower())"
"Labels SHA256: $labelsHash"
"Corpus inventory SHA256: $corpusHash"

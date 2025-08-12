jonfriis@Gamer:/mnt/c/Github/coqui/coqui-ai-TTS/TTS/server/frontend$ yarn run build
yarn run v1.22.22
$ npx tsc && vite build
src/components/ModelSelectionComponent.tsx:11:3 - error TS6133: 'ModelGroupItem' is declared but its value is never read.

11   ModelGroupItem,
     ~~~~~~~~~~~~~~

src/components/ModelSelectionComponent.tsx:18:10 - error TS2724: '"../services/modelService"' has no exported member named 'getModelService'. Did you mean 'ModelService'?

18 import { getModelService } from '../services/modelService';
            ~~~~~~~~~~~~~~~

  src/services/modelService.ts:221:14
    221 export class ModelService {
                     ~~~~~~~~~~~~
    'ModelService' is declared here.

src/components/ModelSelectionComponent.tsx:236:14 - error TS2322: Type '{ children: string; jsx: true; }' is not assignable to type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
  Property 'jsx' does not exist on type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.     

236       <style jsx>{`
                 ~~~

src/services/modelGroupingService.ts:27:11 - error TS6133: '_modelService' is declared but its value is never read.       

27   private _modelService: ModelService;
             ~~~~~~~~~~~~~


Found 4 errors in 2 files.

Errors  Files
     3  src/components/ModelSelectionComponent.tsx:11
     1  src/services/modelGroupingService.ts:27
error Command failed with exit code 2.
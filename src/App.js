import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import {
  Dumbbell, Footprints, BookText, Users,
  CheckCircle, XCircle, Loader2, AlertCircle, Sparkles
} from 'lucide-react';

const initialSkillState = {
  level: 1,
  currentPoints: 0,
  pointsToNextLevel: 100,
};

const levelTitles = [
  "Iniciante", "Aspirante", "Aprendiz", "Praticante", "Adepto",
  "Competente", "Especialista", "Mestre", "Visionário", "Lendário", "Monarca das Sombras"
];

const calculatePointsToNextLevel = (currentLevel) => {
  if (currentLevel < 1) return 100;
  return 100 + (currentLevel - 1) * 20;
};

function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState('carregando...');
  const [skills, setSkills] = useState({
    Forca: { ...initialSkillState },
    Aerobico: { ...initialSkillState },
    Inteligencia: { ...initialSkillState },
    Companheirismo: { ...initialSkillState },
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const showMessage = useCallback((text, type = 'info') => {
    setMessage(text);
    setMessageType(type);
    const timer = setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const app_id = process.env.REACT_APP_APP_ID || 'default-app-id';
        const firebaseConfig = {
          apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
          authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
          storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.REACT_APP_FIREBASE_APP_ID,
          measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
        };

        if (!firebaseConfig.apiKey) {
          showMessage('Configuração do Firebase não encontrada. Os dados NÃO serão persistidos.', 'error');
          setLoading(false);
          return;
        }

        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const firebaseAuth = getAuth(app);

        setDb(firestore);
        setAuth(firebaseAuth);

        if (typeof process.env.REACT_APP_INITIAL_AUTH_TOKEN !== 'undefined') {
          await signInWithCustomToken(firebaseAuth, process.env.REACT_APP_INITIAL_AUTH_TOKEN);
        } else {
          await signInAnonymously(firebaseAuth);
        }

        onAuthStateChanged(firebaseAuth, async (user) => {
          if (user) {
            const currentUserId = user.uid;
            setUserId(currentUserId);

            const userDocRef = doc(firestore, 'artifacts', app_id, 'users', currentUserId, 'skills', 'user_data');

            onSnapshot(userDocRef, (docSnap) => {
              if (docSnap.exists()) {
                const fetchedSkills = docSnap.data().skills;
                setSkills(fetchedSkills);
                showMessage('Dados de habilidades carregados!', 'success');
              } else {
                setDoc(userDocRef, { skills: skills });
                showMessage('Dados de habilidades inicializados!', 'info');
              }
              setLoading(false);
            }, (error) => {
              console.error("Erro ao ouvir dados das habilidades:", error);
              showMessage('Erro ao carregar dados em tempo real. Tente recarregar.', 'error');
              setLoading(false);
            });

          } else {
            console.log("Usuário desautenticado.");
            setLoading(false);
          }
        });

      } catch (error) {
        console.error("Erro na inicialização do Firebase ou autenticação:", error);
        showMessage(`Erro crítico na inicialização: ${error.message}. Recarregue a página.`, 'error');
        setLoading(false);
      }
    };

    initializeFirebase();
  }, [showMessage, skills]);

  const addPoints = useCallback(async (skillName, pointsToAdd) => {
    if (!db || !userId) {
      showMessage('Sistema não pronto. Aguarde o carregamento ou verifique a conexão do Firebase.', 'error');
      return;
    }

    setLoading(true);

    try {
      const app_id = process.env.REACT_APP_APP_ID || 'default-app-id';
      const userDocRef = doc(db, 'artifacts', app_id, 'users', userId, 'skills', 'user_data');
      const currentSkillData = { ...skills[skillName] };

      currentSkillData.currentPoints += pointsToAdd;

      let leveledUp = false;
      let newLevel = currentSkillData.level;
      let newPointsToNextLevel = currentSkillData.pointsToNextLevel;

      while (currentSkillData.currentPoints >= newPointsToNextLevel) {
        currentSkillData.currentPoints -= newPointsToNextLevel;
        newLevel++;
        newPointsToNextLevel = calculatePointsToNextLevel(newLevel);
        leveledUp = true;
      }

      currentSkillData.level = newLevel;
      currentSkillData.pointsToNextLevel = newPointsToNextLevel;

      setSkills(prevSkills => ({
        ...prevSkills,
        [skillName]: currentSkillData,
      }));

      await setDoc(userDocRef, { skills: { ...skills, [skillName]: currentSkillData } }, { merge: true });

      if (leveledUp) {
        showMessage(`Parabéns! Sua habilidade de ${skillName} subiu para o Nível ${newLevel}!`, 'success');
      } else {
        showMessage(`+${pointsToAdd} pontos para ${skillName}!`, 'success');
      }

    } catch (error) {
      console.error("Erro ao adicionar pontos ou nivelar:", error);
      showMessage(`Erro ao atualizar ${skillName}: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [db, userId, skills, showMessage]);

  const getSkillIcon = (skillName) => {
    switch (skillName) {
      case 'Forca': return <Dumbbell className="text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]" size={36} />; // Cor vermelha para Força
      case 'Aerobico': return <Footprints className="text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.7)]" size={36} />; // Cor verde para Aeróbico
      case 'Inteligencia': return <BookText className="text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.7)]" size={36} />; // Cor azul para Inteligência
      case 'Companheirismo': return <Users className="text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.7)]" size={36} />; // Cor roxa para Companheirismo
      default: return null;
    }
  };

  const getProgressBarColor = (skillName) => {
    switch (skillName) {
      case 'Forca': return 'bg-gradient-to-r from-red-600 to-red-400';
      case 'Aerobico': return 'bg-gradient-to-r from-green-600 to-green-400';
      case 'Inteligencia': return 'bg-gradient-to-r from-blue-600 to-blue-400';
      case 'Companheirismo': return 'bg-gradient-to-r from-purple-600 to-purple-400';
      default: return 'bg-gray-700';
    }
  };

  const getButtonColor = (skillName, isBonus = false) => {
    if (isBonus) {
      switch (skillName) {
        case 'Forca': return 'bg-red-800 hover:bg-red-700 active:bg-red-900 border border-red-500 shadow-red-glow';
        case 'Aerobico': return 'bg-green-800 hover:bg-green-700 active:bg-green-900 border border-green-500 shadow-green-glow';
        case 'Inteligencia': return 'bg-blue-800 hover:bg-blue-700 active:bg-blue-900 border border-blue-500 shadow-blue-glow';
        case 'Companheirismo': return 'bg-purple-800 hover:bg-purple-700 active:bg-purple-900 border border-purple-500 shadow-purple-glow';
        default: return 'bg-gray-800 hover:bg-gray-700';
      }
    } else {
      switch (skillName) {
        case 'Forca': return 'bg-red-700 hover:bg-red-600 active:bg-red-800 border border-red-400 shadow-sm';
        case 'Aerobico': return 'bg-green-700 hover:bg-green-600 active:bg-green-800 border border-green-400 shadow-sm';
        case 'Inteligencia': return 'bg-blue-700 hover:bg-blue-600 active:bg-blue-800 border border-blue-400 shadow-sm';
        case 'Companheirismo': return 'bg-purple-700 hover:bg-purple-600 active:bg-purple-800 border border-purple-400 shadow-sm';
        default: return 'bg-gray-700 hover:bg-gray-600';
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-black p-4 font-mono text-gray-50">
      {/* Mensagem de status no topo direito (estilo pop-up de sistema) */}
      {message && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg border-2
                        ${messageType === 'success' ? 'bg-green-900 text-green-300 border-green-500 shadow-green-glow' :
                           messageType === 'error' ? 'bg-red-900 text-red-300 border-red-500 shadow-red-glow' :
                           'bg-blue-900 text-blue-300 border-blue-500 shadow-blue-glow'}
                        flex items-center space-x-2 z-50 text-shadow-glow`}
             style={{ boxShadow: `0 0 10px ${messageType === 'success' ? '#4CAF50' : messageType === 'error' ? '#F44336' : '#2196F3'}` }}>
          {messageType === 'success' && <CheckCircle size={20} className="text-green-400" />}
          {messageType === 'error' && <XCircle size={20} className="text-red-400" />}
          {messageType === 'info' && <AlertCircle size={20} className="text-blue-400" />}
          <span>{message}</span>
        </div>
      )}

      {/* Título Principal - HUD Style */}
      <div className="relative text-center mb-8 p-4 border-b-2 border-blue-500 pb-4 w-full max-w-4xl">
        <h1 className="text-5xl font-bold text-white drop-shadow-lg text-shadow-blue-glow">
          [ SISTEMA: MARCO ZERO ]
        </h1>
        <p className="text-md text-gray-400 mt-2 tracking-wide font-normal">
          Usuário: <span className="font-bold text-blue-400">{userId}</span>
        </p>
        {/* Adiciona linhas de HUD decorativas */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-600"></div>
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-600"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-600"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-600"></div>
      </div>

      {/* Loader Estilizado */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-90 z-50">
          <Loader2 className="animate-spin text-blue-500 drop-shadow-[0_0_15px_rgba(33,150,243,0.8)]" size={64} />
          <p className="ml-3 text-xl text-blue-400 mt-4 text-shadow-blue-glow">Carregando Dados...</p>
        </div>
      )}

      {/* Grid de Habilidades - Cards com estilo de sistema */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl">
        {Object.keys(skills).map((skillName) => {
          const skill = skills[skillName];
          const progress = (skill.currentPoints / skill.pointsToNextLevel) * 100;
          const displayLevel = Math.min(skill.level, levelTitles.length -1); // -1 para não passar do Monarca das Sombras
          const title = levelTitles[displayLevel - 1] || `Nível ${displayLevel}`;

          return (
            <div
              key={skillName}
              className="relative bg-gray-900 rounded-lg border-2 border-gray-700 p-6 flex flex-col items-center
                         transform transition-transform duration-300 hover:scale-[1.02] hover:border-blue-500
                         shadow-lg shadow-black/50"
              style={{
                boxShadow: `0 0 15px rgba(0, 0, 0, 0.7), inset 0 0 5px rgba(255, 255, 255, 0.05)`,
                backgroundImage: `linear-gradient(to bottom, rgba(20,20,20,0.8) 0%, rgba(10,10,10,0.9) 100%)`
              }}
            >
              {/* Contorno de brilho condicional ao passar o mouse */}
              <div className="absolute inset-0 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-300"
                   style={{
                     boxShadow: `0 0 15px var(--glow-color, rgba(33,150,243,0.7))`
                   }}></div>

              <div className="mb-4 flex items-center space-x-4">
                {getSkillIcon(skillName)}
                <h2 className="text-4xl font-bold text-gray-50 text-shadow-glow tracking-wider">
                  {skillName.toUpperCase()}
                </h2>
              </div>
              <p className="text-lg text-gray-300 mb-2 font-light">
                Nível: <span className="font-semibold text-blue-400 text-shadow-blue-glow">{displayLevel} - {title.toUpperCase()}</span>
              </p>
              <p className="text-sm text-gray-400 mb-4 font-normal">
                XP: {skill.currentPoints} / {skill.pointsToNextLevel}
              </p>

              {/* Barra de progresso estilo Solo Leveling */}
              <div className="w-full bg-gray-800 rounded-full h-4 mb-6 overflow-hidden border border-gray-600">
                <div
                  className={`${getProgressBarColor(skillName)} h-full rounded-full transition-all duration-500 ease-out flex items-center justify-center text-xs font-bold text-white text-shadow-sm`}
                  style={{ width: `${Math.min(100, progress)}%`, textShadow: '0 0 5px rgba(255,255,255,0.5)' }}
                >
                  {progress.toFixed(0)}%
                </div>
              </div>

              {/* Botões de Ação com estilo de sistema */}
              <div className="grid grid-cols-2 gap-3 w-full">
                {/* Força */}
                {skillName === 'Forca' && (
                  <>
                    <button
                      onClick={() => addPoints('Forca', 1)}
                      className={`${getButtonColor('Forca')} text-white py-2 px-4 rounded-md shadow-md text-sm font-semibold transition-all duration-200 uppercase tracking-wide border-2 border-red-600 hover:border-red-400 transform hover:scale-[1.03]`}
                    >
                      <Sparkles size={16} className="inline-block mr-1 text-yellow-300" /> +1 FLEXÃO
                    </button>
                    <button
                      onClick={() => addPoints('Forca', 5)}
                      className={`${getButtonColor('Forca')} text-white py-2 px-4 rounded-md shadow-md text-sm font-semibold transition-all duration-200 uppercase tracking-wide border-2 border-red-600 hover:border-red-400 transform hover:scale-[1.03]`}
                    >
                      <Sparkles size={16} className="inline-block mr-1 text-yellow-300" /> +5 LEVANTAMENTO
                    </button>
                    <button
                      onClick={() => addPoints('Forca', 15)}
                      className={`${getButtonColor('Forca', true)} text-white py-2 px-4 rounded-md shadow-md text-sm font-bold transition-all duration-200 uppercase tracking-wide col-span-2 border-2 border-red-500 hover:border-red-300 transform hover:scale-[1.03] animate-pulse-light`}
                    >
                      <Sparkles size={18} className="inline-block mr-2 text-yellow-300 animate-spin-slow" /> BÔNUS: SUPERAÇÃO <Sparkles size={18} className="inline-block ml-2 text-yellow-300 animate-spin-slow" />
                    </button>
                  </>
                )}

                {/* Aeróbico */}
                {skillName === 'Aerobico' && (
                  <>
                    <button
                      onClick={() => addPoints('Aerobico', 5)}
                      className={`${getButtonColor('Aerobico')} text-white py-2 px-4 rounded-md shadow-md text-sm font-semibold transition-all duration-200 uppercase tracking-wide border-2 border-green-600 hover:border-green-400 transform hover:scale-[1.03]`}
                    >
                      <Sparkles size={16} className="inline-block mr-1 text-yellow-300" /> +5KM CORRIDA
                    </button>
                    <button
                      onClick={() => addPoints('Aerobico', 2)}
                      className={`${getButtonColor('Aerobico')} text-white py-2 px-4 rounded-md shadow-md text-sm font-semibold transition-all duration-200 uppercase tracking-wide border-2 border-green-600 hover:border-green-400 transform hover:scale-[1.03]`}
                    >
                      <Sparkles size={16} className="inline-block mr-1 text-yellow-300" /> +2KM CAMINHADA
                    </button>
                    <button
                      onClick={() => addPoints('Aerobico', 10)}
                      className={`${getButtonColor('Aerobico', true)} text-white py-2 px-4 rounded-md shadow-md text-sm font-bold transition-all duration-200 uppercase tracking-wide col-span-2 border-2 border-green-500 hover:border-green-300 transform hover:scale-[1.03] animate-pulse-light`}
                    >
                      <Sparkles size={18} className="inline-block mr-2 text-yellow-300 animate-spin-slow" /> BÔNUS: ACELERAÇÃO <Sparkles size={18} className="inline-block ml-2 text-yellow-300 animate-spin-slow" />
                    </button>
                  </>
                )}

                {/* Inteligência */}
                {skillName === 'Inteligencia' && (
                  <>
                    <button
                      onClick={() => addPoints('Inteligencia', 20)}
                      className={`${getButtonColor('Inteligencia')} text-white py-2 px-4 rounded-md shadow-md text-sm font-semibold transition-all duration-200 uppercase tracking-wide border-2 border-blue-600 hover:border-blue-400 transform hover:scale-[1.03]`}
                    >
                      <Sparkles size={16} className="inline-block mr-1 text-yellow-300" /> +20 LIVRO CONCLUÍDO
                    </button>
                    <button
                      onClick={() => addPoints('Inteligencia', 10)}
                      className={`${getButtonColor('Inteligencia')} text-white py-2 px-4 rounded-md shadow-md text-sm font-semibold transition-all duration-200 uppercase tracking-wide border-2 border-blue-600 hover:border-blue-400 transform hover:scale-[1.03]`}
                    >
                      <Sparkles size={16} className="inline-block mr-1 text-yellow-300" /> +10 ESTUDO FOCADO
                    </button>
                    <button
                      onClick={() => addPoints('Inteligencia', 30)}
                      className={`${getButtonColor('Inteligencia')} text-white py-2 px-4 rounded-md shadow-md text-sm font-semibold transition-all duration-200 uppercase tracking-wide border-2 border-blue-600 hover:border-blue-400 transform hover:scale-[1.03]`}
                    >
                      <Sparkles size={16} className="inline-block mr-1 text-yellow-300" /> +30 APRENDIZADO PRÁTICO
                    </button>
                    <button
                      onClick={() => addPoints('Inteligencia', 20)}
                      className={`${getButtonColor('Inteligencia', true)} text-white py-2 px-4 rounded-md shadow-md text-sm font-bold transition-all duration-200 uppercase tracking-wide border-2 border-blue-500 hover:border-blue-300 transform hover:scale-[1.03] animate-pulse-light`}
                    >
                      <Sparkles size={18} className="inline-block mr-2 text-yellow-300 animate-spin-slow" /> BÔNUS: COMPARTILHAR <Sparkles size={18} className="inline-block ml-2 text-yellow-300 animate-spin-slow" />
                    </button>
                  </>
                )}

                {/* Companheirismo */}
                {skillName === 'Companheirismo' && (
                  <>
                    <button
                      onClick={() => addPoints('Companheirismo', 15)}
                      className={`${getButtonColor('Companheirismo')} text-white py-2 px-4 rounded-md shadow-md text-sm font-semibold transition-all duration-200 uppercase tracking-wide border-2 border-purple-600 hover:border-purple-400 transform hover:scale-[1.03]`}
                    >
                      <Sparkles size={16} className="inline-block mr-1 text-yellow-300" /> +15 MOTIVAÇÃO
                    </button>
                    <button
                      onClick={() => addPoints('Companheirismo', 10)}
                      className={`${getButtonColor('Companheirismo')} text-white py-2 px-4 rounded-md shadow-md text-sm font-semibold transition-all duration-200 uppercase tracking-wide border-2 border-purple-600 hover:border-purple-400 transform hover:scale-[1.03]`}
                    >
                      <Sparkles size={16} className="inline-block mr-1 text-yellow-300" /> +10 APOIO ATIVO
                    </button>
                    <button
                      onClick={() => addPoints('Companheirismo', 20)}
                      className={`${getButtonColor('Companheirismo')} text-white py-2 px-4 rounded-md shadow-md text-sm font-semibold transition-all duration-200 uppercase tracking-wide border-2 border-purple-600 hover:border-purple-400 transform hover:scale-[1.03]`}
                    >
                      <Sparkles size={16} className="inline-block mr-1 text-yellow-300" /> +20 CELEBRAÇÃO CONJUNTA
                    </button>
                    <button
                      onClick={() => addPoints('Companheirismo', 25)}
                      className={`${getButtonColor('Companheirismo', true)} text-white py-2 px-4 rounded-md shadow-md text-sm font-bold transition-all duration-200 uppercase tracking-wide border-2 border-purple-500 hover:border-purple-300 transform hover:scale-[1.03] animate-pulse-light`}
                    >
                      <Sparkles size={18} className="inline-block mr-2 text-yellow-300 animate-spin-slow" /> BÔNUS: FORTALECER LAÇOS <Sparkles size={18} className="inline-block ml-2 text-yellow-300 animate-spin-slow" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rodapé - Desafios e Metas - Estilo de Relatório do Sistema */}
      <div className="mt-8 w-full max-w-5xl bg-gray-900 rounded-lg border-2 border-gray-700 p-6 text-gray-50
                      shadow-lg shadow-black/50"
           style={{
             backgroundImage: `linear-gradient(to bottom, rgba(20,20,20,0.8) 0%, rgba(10,10,10,0.9) 100%)`
           }}>
        <h2 className="text-2xl font-bold mb-4 text-center text-blue-400 text-shadow-blue-glow">
          [ MISSÕES E RECOMPENSAS ]
        </h2>
        <div className="mb-4 p-3 border border-gray-700 rounded-md">
          <h3 className="text-xl font-semibold mb-2 flex items-center justify-center text-green-400">
            <CheckCircle className="mr-2 text-green-500" />DESAFIOS TEMÁTICOS
          </h3>
          <p className="text-center text-gray-300 font-light text-sm">
            Complete objetivos especiais para ativar bônus de XP em várias habilidades!
          </p>
          <ul className="list-disc list-inside text-gray-400 mt-2 px-4 text-sm">
            <li>Ex: "Desafio da Primavera: Corra 10km (Aeróbico), leia um livro sobre sustentabilidade (Inteligência), e motive um amigo a se exercitar ao ar livre (Companheirismo)."</li>
            <li className="text-xs italic text-gray-500"> (Funcionalidade para adicionar esses desafios não implementada neste exemplo, mas pode ser expandida.)</li>
          </ul>
        </div>
        <div className="p-3 border border-gray-700 rounded-md">
          <h3 className="text-xl font-semibold mb-2 flex items-center justify-center text-red-400">
            <CheckCircle className="mr-2 text-red-500" />METAS PESSOAIS
          </h3>
          <p className="text-center text-gray-300 font-light text-sm">
            Defina seus próprios objetivos e receba bônus massivos ao alcançá-los!
          </p>
          <ul className="list-disc list-inside text-gray-400 mt-2 px-4 text-sm">
            <li>Ex: "Meta: Fazer 50 flexões seguidas: +50 XP Força!"</li>
            <li>Ex: "Meta: Ler um livro por semana: +100 XP Inteligência!"</li>
            <li className="text-xs italic text-gray-500"> (Funcionalidade para definir e registrar metas não implementada, mas pode ser expandida.)</li>
          </ul>
        </div>
      </div>

      {/* Tailwind Custom CSS (para efeitos de brilho) */}
      <style>{`
        .text-shadow-glow {
          text-shadow: 0 0 5px rgba(255,255,255,0.8), 0 0 10px rgba(255,255,255,0.6);
        }
        .text-shadow-blue-glow {
          text-shadow: 0 0 5px rgba(96,165,250,0.8), 0 0 10px rgba(96,165,250,0.6);
        }
        .shadow-red-glow {
          box-shadow: 0 0 10px rgba(239,68,68,0.6);
        }
        .shadow-green-glow {
          box-shadow: 0 0 10px rgba(74,222,128,0.6);
        }
        .shadow-blue-glow {
          box-shadow: 0 0 10px rgba(96,165,250,0.6);
        }
        .shadow-purple-glow {
          box-shadow: 0 0 10px rgba(192,132,252,0.6);
        }
        @keyframes pulse-light {
          0%, 100% {
            transform: scale(1);
            filter: brightness(1);
          }
          50% {
            transform: scale(1.01);
            filter: brightness(1.2);
          }
        }
        .animate-pulse-light {
          animation: pulse-light 2s infinite ease-in-out;
        }
        @keyframes spin-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 5s linear infinite;
        }
      `}</style>
    </div>
  );
}

export default App;
